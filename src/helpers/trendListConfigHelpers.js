import AWSXRay from "aws-xray-sdk-core";
import AWSSDK from "aws-sdk";

import { createPromiseCB } from "../helpers/promiseHelpers";

const AWS = AWSXRay.captureAWS(AWSSDK);
const dynamodb = new AWS.DynamoDB();

export const getTrendListConfigById = id =>
  new Promise((resolve, reject) => {
    dynamodb.getItem(
      {
        TableName: "TrendListConfigs",
        Key: {
          trendListId: {
            S: id
          }
        }
      },
      createPromiseCB(resolve, reject)
    );
  }).then(data => {
    console.log("config data:::::", data);

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
    console.log("caught error:::", err.message);

    if (/^TrendListConfig not found for default$/.test(err.message)) {
      throw new Error("Default TrendListConfig item is missing");
    }
    if (/^TrendListConfig not found for/.test(err.message)) {
      console.log("in herrrrre");
      return getTrendListConfigById("default");
    }
    throw err;
  });
