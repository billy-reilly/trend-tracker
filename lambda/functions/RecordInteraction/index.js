const AWSXRay = require("aws-xray-sdk-core");
const AWS = AWSXRay.captureAWS(require("aws-sdk"));
const dynamodb = new AWS.DynamoDB();
const lambda = new AWS.Lambda();

const config = {
  TS: {
    trendListLimit: 10,
    aggregationWindow: 1000 * 60 // 1 min in ms
  }
};

const recordIncrementEvent = (id, expiration_timestamp, catalogId) =>
  new Promise((resolve, reject) => {
    dynamodb.putItem(
      {
        TableName: "IncrementEvents",
        Item: {
          id: {
            S: id
          },
          expiration_timestamp: {
            N: expiration_timestamp.toString()
          },
          catalogId: {
            S: catalogId
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

const incrementItemCount = (id, catalogId) =>
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
        UpdateExpression:
          "set eventCount = if_not_exists(eventCount, :zero) + :inc",
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
  // TODO event validation
  const { queryStringParameters: { catalogId } = {}, body = "" } = event;
  const id = JSON.parse(body).id; //

  const inc_timestamp = new Date().getTime();

  // TODO: make safe
  const expiration_timestamp =
    inc_timestamp + config[catalogId].aggregationWindow;

  recordIncrementEvent(id, expiration_timestamp, catalogId)
    .catch(err => {
      // TODO: response handlers
      cb(null, {
        statusCode: 500,
        body: `Error writing increment record: ${err.message}`
      });
    })
    .then(() => {
      incrementItemCount(id, catalogId)
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
                  catalogId: "TS"
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
