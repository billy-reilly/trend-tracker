import AWSXRay from "aws-xray-sdk-core";
import AWSSDK from "aws-sdk";

import configs from "../trend-list-configs";

const AWS = AWSXRay.captureAWS(AWSSDK);
const dynamodb = new AWS.DynamoDB();
const lambda = new AWS.Lambda();

const recordIncrementEvent = (itemId, expirationTimestamp, trendListId) =>
  new Promise((resolve, reject) => {
    dynamodb.putItem(
      {
        TableName: "Interactions",
        Item: {
          itemId: {
            S: itemId
          },
          expirationTimestamp: {
            N: expirationTimestamp.toString()
          },
          trendListId: {
            S: trendListId
          }
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

const incrementItemCount = (itemId, trendListId) =>
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
        UpdateExpression:
          "set interactionCount = if_not_exists(interactionCount, :zero) + :inc",
        ExpressionAttributeValues: {
          ":inc": { N: "1" },
          ":zero": { N: "0" }
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

export const handler = (event, context, cb) => {
  const { queryStringParameters: { trendListId } = {}, body = "" } = event;
  const itemId = JSON.parse(body).itemId;

  const interactionTimestamp = new Date().getTime();

  const config = configs[trendListId] || configs.default;
  const expirationTimestamp = interactionTimestamp + config.aggregationWindow;

  return recordIncrementEvent(itemId, expirationTimestamp, trendListId)
    .then(() => {
      return incrementItemCount(itemId, trendListId)
        .then(() => {
          return lambda.invoke(
            {
              FunctionName: "GetTrendingItems",
              Payload: JSON.stringify({
                queryStringParameters: {
                  trendListId
                }
              })
            },
            (err, data) => {
              if (err) {
                return cb(null, {
                  statusCode: 500,
                  body: `Error invoking GetTrendingItems from RecordInteraction: ${err.message}`
                });
              }

              try {
                const response = JSON.parse(data.Payload);
                cb(null, response);
              } catch (err) {
                cb(null, {
                  statusCode: 500,
                  body: `Error parsing response from GetTrendingItems: ${err}`
                });
              }
            }
          );
        })
        .catch(err => {
          cb(null, {
            statusCode: 500,
            body: `Error updating count: ${err.message}`
          });
        });
    })
    .catch(err => {
      cb(null, {
        statusCode: 500,
        body: `Error writing increment record: ${err.message}`
      });
    });
};
