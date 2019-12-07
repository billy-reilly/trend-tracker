import AWS from "aws-sdk";

import { send, SUCCESS, FAILED } from "../helpers/customResourceResponder";
import { createPromiseCB } from "../helpers/promiseHelpers";

const dynamodb = new AWS.DynamoDB();

const defaultAggregationWindow = 60; // 1 hr in ms
const defaultTrendListConfig = {
  trendListId: {
    S: "default"
  },
  trendListLimit: {
    N: "10"
  },
  aggregationWindow: {
    N: defaultAggregationWindow.toString()
  }
};

const putDefaultTrendListConfig = () =>
  new Promise((resolve, reject) => {
    dynamodb.putItem(
      {
        TableName: "TrendListConfigs",
        Item: defaultTrendListConfig
      },
      createPromiseCB(resolve, reject)
    );
  });

export const handler = (event, context) => {
  if (event.RequestType === "Create") {
    return putDefaultTrendListConfig()
      .then(() =>
        send(event, context, SUCCESS, {
          Message: "Successfully seeded TrendListConfigs table"
        })
      )
      .catch(err =>
        send(event, context, FAILED, {
          Message: `Error seeding TrendListConfigs table: ${err.message}`
        })
      );
  }

  return send(event, context, SUCCESS, {
    Message: "Custom resource request not of type Create"
  });
};
