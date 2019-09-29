const AWSXRay = require("aws-xray-sdk-core");
const AWS = AWSXRay.captureAWS(require("aws-sdk"));
const dynamodb = new AWS.DynamoDB();

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
        Limit: 100,
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
                body: `Error reading eventCounts from dynamodb: ${err.message}`
              });
            });
        });
    });
};
