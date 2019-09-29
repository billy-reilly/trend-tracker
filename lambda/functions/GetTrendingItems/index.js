const AWSXRay = require("aws-xray-sdk-core");
const AWS = AWSXRay.captureAWS(require("aws-sdk"));
const dynamodb = new AWS.DynamoDB();

const config = {
  TS: {
    trendListLimit: "10",
    aggregationWindow: 1000 * 60 // 1 min in ms
  }
};

const getTrendingItems = catalogId =>
  new Promise((resolve, reject) => {
    dynamodb.query(
      {
        TableName: "ItemCounts",
        IndexName: "catalogId-eventCount-index",
        KeyConditionExpression: "catalogId = :cat",
        ExpressionAttributeValues: {
          ":cat": {
            S: catalogId
          }
        },
        ProjectionExpression: "id, eventCount",
        Limit: config[catalogId].trendListLimit,
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
  if (!(event.queryStringParameters && event.queryStringParameters.catalogId)) {
    // TODO: handle invalid catalogId e.g. XX

    return cb(null, {
      statusCode: 400,
      body: JSON.stringify({
        message: "catalogId is a required query parameter"
      })
    });
  }

  return getTrendingItems(event.queryStringParameters.catalogId)
    .then(data => {
      try {
        const responseBody = data.Items.reduce(
          (acc, item) => ({
            ...acc,
            [item.id.S]: item.eventCount.N
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
