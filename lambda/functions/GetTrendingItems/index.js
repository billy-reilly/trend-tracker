const AWSXRay = require("aws-xray-sdk-core");
const AWS = AWSXRay.captureAWS(require("aws-sdk"));
const dynamodb = new AWS.DynamoDB();

const configs = {
  shoes: {
    trendListLimit: "3",
    aggregationWindow: 1000 * 60 // 1 min in ms
  },
  default: {
    trendListLimit: "10",
    aggregationWindow: 1000 * 60 // 1 min in ms
  }
};

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
        ScanIndexForward: false
      },
      (err, data) => {
        if (err) {
          reject(err);
        }
        resolve(data);
      }
    );
  });

exports.handler = (event, context, cb) => {
  if (
    !(event.queryStringParameters && event.queryStringParameters.trendListId)
  ) {
    return cb(null, {
      statusCode: 400,
      body: JSON.stringify({
        message: "trendListId is a required query parameter"
      })
    });
  }

  const { trendListId } = event.queryStringParameters;

  return getTrendingItems(trendListId)
    .then(data => {
      try {
        const responseBody = data.Items.reduce(
          (acc, item) => ({
            ...acc,
            [item.itemId.S]: item.interactionCount.N
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
