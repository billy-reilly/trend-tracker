import AWSXRay from "aws-xray-sdk-core";
import AWSSDK from "aws-sdk";

import { getTrendListConfig } from "../helpers/trendListConfigHelpers";
import { createPromiseCB } from "../helpers/promiseHelpers";

const AWS = AWSXRay.captureAWS(AWSSDK);
const dynamodb = new AWS.DynamoDB();
const lambda = new AWS.Lambda();

const recordIncrementEvent = (itemId, expirationTimestamp, trendListId) =>
  new Promise((resolve, reject) => {
    dynamodb.putItem(
      {
        TableName: `${process.env.STACK_NAME}-Interactions`,
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
      createPromiseCB(resolve, reject)
    );
  });

const incrementItemCount = (itemId, trendListId) =>
  new Promise((resolve, reject) => {
    dynamodb.updateItem(
      {
        TableName: `${process.env.STACK_NAME}-InteractionCounts`,
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
      createPromiseCB(resolve, reject)
    );
  });

const invokeGetTrendingItems = (trendListId, config) =>
  new Promise((resolve, reject) => {
    lambda.invoke(
      {
        FunctionName: `${process.env.STACK_NAME}-GetTrendingItems`,
        Payload: JSON.stringify({
          queryStringParameters: {
            trendListId
          },
          config
        })
      },
      createPromiseCB(resolve, reject)
    );
  });

export const handler = (event, context, cb) => {
  const { queryStringParameters: { trendListId } = {}, body = "" } = event;
  const itemId = JSON.parse(body).itemId;

  const interactionTimestamp = new Date().getTime();

  return (
    getTrendListConfig(trendListId)
      .then(config => {
        const { aggregationWindow } = config;
        const expirationTimestamp =
          interactionTimestamp + aggregationWindow * 60 * 1000;

        return recordIncrementEvent(itemId, expirationTimestamp, trendListId)
          .then(() => {
            return incrementItemCount(itemId, trendListId)
              .then(() => {
                return invokeGetTrendingItems(trendListId, config)
                  .then(upstreamResponse => {
                    try {
                      const response = JSON.parse(upstreamResponse.Payload);
                      cb(null, response);
                    } catch (err) {
                      cb(null, {
                        statusCode: 500,
                        body: `Error parsing response from GetTrendingItems: ${err}`
                      });
                    }
                  })
                  .catch(err => {
                    cb(null, {
                      statusCode: 500,
                      body: `Error invoking GetTrendingItems from RecordInteraction: ${err.message}`
                    });
                  });
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
      })
      // config error
      .catch(err => {
        return cb(null, {
          statusCode: 500,
          body: err.message
        });
      })
  );
};
