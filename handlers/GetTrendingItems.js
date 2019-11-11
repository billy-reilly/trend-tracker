import AWSXRay from "aws-xray-sdk-core";
import AWSSDK from "aws-sdk";

import configs from "../trend-list-configs";

const AWS = AWSXRay.captureAWS(AWSSDK);
const dynamodb = new AWS.DynamoDB();

const getTrendingItems = trendListId =>
  new Promise((resolve, reject) => {
    const config = configs[trendListId] || configs.default;
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
        Limit: config.trendListLimit,
        ScanIndexForward: false,
        ConsistentRead: true
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
  const { trendListId } = event.queryStringParameters;

  return getTrendingItems(trendListId)
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
    });
};
