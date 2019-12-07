# trend-tracker

## What is it?

This is a RESTful service for tracking lists of trending items.

When a user performs an interaction, you can POST the id of the item that they've interacted with along with the id of the trending list you want to track it in:

eg on an image sharing platform you might want to track the most 'liked' images

```
POST /?trendListId=likedImages
Host: example.com
Content-Type: application/json
Content-Length: 24

{
  "itemId": "boring_sunset"
}
```

Then when you want to consume that list you send a GET request with the list id:

```
GET /?trendListId=likedImages
Host: example.com
```

This returns a mapping of the top item IDs to interaction counts:

```
{
  "cat1": 102,
  "cat2": 99,
  "cat3": 95,
  "cat4": 81,
  "boring_sunset": 1
}
```

You can specify the the size of this list (eg top 10 or top 100), and the period over which you'd like to aggregate the results (eg over the last hour) - see `trend-list-configs.js` in the project root

It also supports multiple lists so on our imaginary image sharing platform we could keep another trend list of the images with the most comments, for example

## Service design

![service diagram](./service-diagram.png)

## How to deploy to your own AWS account

\*\* Note this project is still a work in progress - use at your own risk

1. Clone this repository

2. Build your lambda code:

   2.1. install npm dependencies: `npm i`

   2.2. bundle the code: `npm run build`

3. [Create an S3 bucket](https://docs.aws.amazon.com/AmazonS3/latest/gsg/CreatingABucket.html) with the name `trend-tracker`

4. Ensure you have the AWS SAM CLI installed and configured (you can follow [this installation guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) - but skip the steps for creating an S3 bucket and installing docker)

5. Package and upload your deployment artifacts: `npm run sam:package`

6. Deploy the service: `npm run sam:deploy`

7. (Optional) [Test the API](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-call-api.html#apigateway-how-to-call-rest-api) and then monitor the service maps [in X-Ray](https://docs.aws.amazon.com/xray/latest/devguide/aws-xray.html)

## Configuring trend lists to match your use case

You can specify a configuration on a per trend list basis, or you can edit the default configuration which applies to to all trend lists without their own config.

A config object has the following attributes:

- trendListId: this is the string identifier for the trend list you are targeting. The default config has trendListId = 'default'
- trendListLimit: this is a number that represents the size of your trend list. E.g. if you want to count the top 10 liked images on your site you'd set trendListLimit to 10
- aggregationWindow: this is a number that represents the time over which you would like to aggregate your interactions, in minutes. E.g. if you'd like to know the top 10 liked images over the last hour you'd set aggregationWindow to 60. The shorter you make this window the more responsive your list will be to changes in user behaviour

There are two ways to set your own trend list configurations:

1. You can deploy the service to your own AWS account, and then edit the TrendListConfigs DynamoDB table directly in your AWS management console. Note that if you do this and end up deleting & redeploying the cloudformation stack your edits will be lost

2. You can update the `TrendListConfigsSeeder` - this is the lambda function that puts the initial data into the TrendListConfigs DynamoDB table when the service is deployed. This will mean your updated configuration will be applied each time you redeploy the service

## TODOs:

- [x] Commit infrastructure as code? - cloudformation / serverless framework
- [x] Bundle handlers using webpack
- [x] Move configs into DynamoDB table
- [ ] Put config table behind DAX cluster
- [x] Unit tests
- [x] CodeBuild job running unit tests against PRs
- [ ] Acceptance tests
- [ ] CodeBuild job for running acceptance tests against PRs
- [ ] Clean out items with a count of 0 from `InteractionCounts` table
- [ ] Use dynamodb transactions to prevent two tables becoming out of sync
- [ ] Make deployment more configurable - allow stack name / bucket name specification
- [ ] Create reusable response helpers
- [ ] Enforce code style - (eslint + prettier)
- [ ] Performance / load testing
- [ ] Demo FE application
