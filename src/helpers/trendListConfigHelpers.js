import AWSXRay from "aws-xray-sdk-core";
import AWSSDK from "aws-sdk";

import { createPromiseCB } from "../helpers/promiseHelpers";

const AWS = AWSXRay.captureAWS(AWSSDK);
const dynamodb = new AWS.DynamoDB();

const getTrendListConfigById = id =>
  new Promise((resolve, reject) => {
    dynamodb.getItem(
      {
        TableName: `${process.env.STACK_NAME}-TrendListConfigs`,
        Key: {
          trendListId: {
            S: id
          }
        }
      },
      createPromiseCB(resolve, reject)
    );
  }).then(data => {
    if (!data.Item) {
      throw new Error(`TrendListConfig not found for ${id}`);
    }

    let formattedData;
    try {
      formattedData = {
        trendListLimit: data.Item.trendListLimit.N,
        aggregationWindow: parseInt(data.Item.aggregationWindow.N, 10)
      };
    } catch (e) {
      throw new Error(
        `TrendListConfig data of unexpected shape for ${id}: ${e.message}`
      );
    }
    return formattedData;
  });

export const getTrendListConfig = id =>
  getTrendListConfigById(id).catch(err => {
    if (/^TrendListConfig not found for/.test(err.message)) {
      return getTrendListConfigById("default");
    }
    throw err;
  });
