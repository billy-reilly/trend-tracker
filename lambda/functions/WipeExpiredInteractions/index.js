const AWSXRay = require("aws-xray-sdk-core");
const AWS = AWSXRay.captureAWS(require("aws-sdk"));
const dynamodb = new AWS.DynamoDB();

const decrementItemCount = ({ id, catalogId }) =>
  new Promise((resolve, reject) => {
    dynamodb.updateItem(
      {
        TableName: "ItemCounts",
        Key: {
          id: {
            S: id
          },
          catalogId: {
            S: catalogId
          }
        },
        // TODO: handle 0 or minus counts?
        UpdateExpression:
          "set eventCount = if_not_exists(eventCount, :one) - :dec",
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

const removeEventRecord = ({ id, expiration_timestamp }) =>
  new Promise((resolve, reject) => {
    dynamodb.deleteItem(
      {
        TableName: "IncrementEvents",
        Key: {
          id: {
            S: id
          },
          expiration_timestamp: {
            N: expiration_timestamp
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

exports.handler = (event, context, cb) => {
  const now = new Date().getTime();
  // TODO: break out into getExpiredEvents function
  return dynamodb.scan(
    {
      TableName: "IncrementEvents",
      FilterExpression: "expiration_timestamp < :now",
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
              id: item.id.S,
              catalogId: item.catalogId.S,
              expiration_timestamp: item.expiration_timestamp.N
            }
          ];
        }, []);
      } catch (err) {
        return cb(null, {
          statusCode: 500,
          body: `Error formatting data ${err.message}`
        });
      }

      const hasEventsToClearUp = formattedEvents && formattedEvents.length;

      // TODO: make this easier to read
      return formattedEvents
        .reduce((previousPromise, eventData) => {
          return previousPromise
            .then(() => decrementItemCount(eventData))
            .then(() => removeEventRecord(eventData));
          // TODO: clean up items with count 0?
        }, Promise.resolve())
        .then(() => {
          return cb(null, {
            statusCode: 200,
            body: `HAS REMOVED EVENTS: ${hasEventsToClearUp ? "YES" : "NO"}`
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
