import AWSXRay from "aws-xray-sdk-core";
import AWSSDK from "aws-sdk";

const AWS = AWSXRay.captureAWS(AWSSDK);
const dynamodb = new AWS.DynamoDB();

const decrementInteractionCount = ({ itemId, trendListId }) =>
  new Promise((resolve, reject) => {
    dynamodb.updateItem(
      {
        TableName: "InteractionCounts",
        Key: {
          itemId: {
            S: itemId
          },
          trendListId: {
            S: trendListId
          }
        },
        // TODO: handle 0 or minus counts?
        UpdateExpression:
          "set interactionCount = if_not_exists(interactionCount, :one) - :dec",
        ExpressionAttributeValues: {
          ":dec": { N: "1" },
          ":one": { N: "1" }
        }
      },
      (err, data) => {
        if (err) {
          reject(err);
        }
        resolve(data);
      }
    );
  });

const removeInteraction = ({ itemId, expirationTimestamp }) =>
  new Promise((resolve, reject) => {
    dynamodb.deleteItem(
      {
        TableName: "Interactions",
        Key: {
          itemId: {
            S: itemId
          },
          expirationTimestamp: {
            N: expirationTimestamp
          }
        }
      },
      (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data);
      }
    );
  });

export const handler = (event, context, cb) => {
  const now = new Date().getTime();
  // TODO: break out into getExpiredEvents
  return dynamodb.scan(
    {
      TableName: "Interactions",
      FilterExpression: "expirationTimestamp < :now",
      ExpressionAttributeValues: {
        ":now": {
          N: now.toString()
        }
      }
    },
    (err, data) => {
      if (err) {
        return cb(null, {
          statusCode: 500,
          body: `Error scanning db table ${err.message}`
        });
      }

      let formattedEvents;
      try {
        formattedEvents = data.Items.reduce((acc, item) => {
          return [
            ...acc,
            {
              itemId: item.itemId.S,
              trendListId: item.trendListId.S,
              expirationTimestamp: item.expirationTimestamp.N
            }
          ];
        }, []);
      } catch (err) {
        cb(null, {
          statusCode: 500,
          body: `Error formatting data ${err.message}`
        });
        return Promise.resolve();
      }

      const hasEventsToClearUp = formattedEvents && formattedEvents.length;

      // TODO: make this easier to read
      return formattedEvents
        .reduce((previousPromise, eventData) => {
          return previousPromise
            .then(() => decrementInteractionCount(eventData))
            .then(() => removeInteraction(eventData));
          // TODO: clean up items with count 0?
        }, Promise.resolve())
        .then(() => {
          return cb(null, {
            statusCode: 200,
            body: `HAS REMOVED INTERACTIONS: ${
              hasEventsToClearUp ? "YES" : "NO"
            }`
          });
        })
        .catch(err => {
          return cb(null, {
            statusCode: 500,
            body: `Error in removal promise chain ${err.message}`
          });
        });
    }
  );
};
