import AWSXRay from "aws-xray-sdk-core";
import AWSSDK from "aws-sdk";

import { getTrendListConfig } from "../helpers/trendListConfigHelpers";
import { createPromiseCB } from "../helpers/promiseHelpers";

const AWS = AWSXRay.captureAWS(AWSSDK);
const dynamodb = new AWS.DynamoDB();

const getTrendingItems = (trendListId, trendListLimit) =>
  new Promise((resolve, reject) => {
    dynamodb.query(
      {
        TableName: "InteractionCounts",
        IndexName: "trendListId-interactionCount-index",
        KeyConditionExpression: "trendListId = :tl",
        ExpressionAttributeValues: {
          ":tl": {
            S: trendListId
          }
        },
        ProjectionExpression: "itemId, interactionCount",
        Limit: trendListLimit,
        ScanIndexForward: false,
        ConsistentRead: true
      },
      createPromiseCB(resolve, reject)
    );
  });

export const handler = (event, context, cb) => {
  // TODO when called from RecordInteraction pass down config and save extra DB reads

  const { trendListId } = event.queryStringParameters;

  // const configPromise = event.config
  //   ? getTrendListConfig(trendListId)
  //   : Promise.resolve(event.config);

  return (
    getTrendListConfig(trendListId)
      .then(({ trendListLimit }) =>
        getTrendingItems(trendListId, trendListLimit)
          .then(data => {
            try {
              const responseBody = data.Items.reduce(
                (acc, item) => ({
                  ...acc,
                  [item.itemId.S]: parseInt(item.interactionCount.N, 10)
                }),
                {}
              );

              cb(null, {
                statusCode: 200,
                body: JSON.stringify(responseBody)
              });
            } catch (e) {
              cb(null, {
                statusCode: 500,
                body: `Error formatting responseBody: ${e.message}`
              });
            }
          })
          .catch(err => {
            return cb(null, {
              statusCode: 500,
              body: `Error reading from dynamodb: ${err.message}`
            });
          })
      )
      // config error:
      .catch(err => {
        return cb(null, {
          statusCode: 500,
          body: err.message
        });
      })
  );
};
