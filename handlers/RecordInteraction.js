const AWSXRay = require("aws-xray-sdk-core");
const AWS = AWSXRay.captureAWS(require("aws-sdk"));
const dynamodb = new AWS.DynamoDB();
const lambda = new AWS.Lambda();

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

exports.handler = (event, context, cb) => {
  if (
    !(event.queryStringParameters && event.queryStringParameters.trendListId)
  ) {
    // TODO: request body validation
    return cb(null, {
      statusCode: 400,
      body: JSON.stringify({
        message: "trendListId is a required query parameter"
      })
    });
  }

  const { queryStringParameters: { trendListId } = {}, body = "" } = event;
  const itemId = JSON.parse(body).itemId;

  const interactionTimestamp = new Date().getTime();

  // TODO: make safe
  const config = configs[trendListId] || configs.default;
  const expirationTimestamp = interactionTimestamp + config.aggregationWindow;

  recordIncrementEvent(itemId, expirationTimestamp, trendListId)
    .catch(err => {
      // TODO: response handlers
      cb(null, {
        statusCode: 500,
        body: `Error writing increment record: ${err.message}`
      });
    })
    .then(() => {
      incrementItemCount(itemId, trendListId)
        .catch(err => {
          cb(null, {
            statusCode: 500,
            body: `Error updating count: ${err.message}`
          });
        })
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
              const upstreamResponse = data;
              const response = JSON.parse(upstreamResponse.Payload);
              cb(null, response);
            }
          );
        });
    });
};
