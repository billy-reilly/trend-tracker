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

You can specify the the size of this list (eg top 10 or top 100), and the period over which you'd like to aggregate the results (eg over the last hour) - see `configs` in lambda functions

It also supports multiple lists so on our imaginary image sharing platform we could keep another list of the images with the most comments, for example

## Service design

![service diagram](./service-diagram.png)

## How to deploy to your own AWS account
** Note this project is still a work in progress - use at your own risk

1. Clone this repository

2. Modify the configuration in `./trend-list-configs.js` to fit your use case. You can define rules on a per-list basis as well as having defaults.

3. Build your configured lambda code:

   3.1. install npm dependencies: `npm i`

   3.2. bundle the code: `npm run build`

4. [Create an S3 bucket](https://docs.aws.amazon.com/AmazonS3/latest/gsg/CreatingABucket.html) with the name `trend-tracker`

5. Ensure you have the AWS SAM CLI installed and configured (you can follow [this installation guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) - but skip the steps for creating an S3 bucket and installing docker)

6. Package and upload your deployment artifacts: `npm run sam:package`

7. Deploy the service: `npm run sam:deploy`

8. (Optional) Test the API and then monitor the service maps [in X-Ray](https://docs.aws.amazon.com/xray/latest/devguide/aws-xray.html)

## TODOs:

- [ ] Clean out items with a count of 0 from `InteractionCounts` table
- [ ] Use dynamodb transactions to prevent two tables becoming out of sync
- [x] CodeBuild job for PRs
- [ ] CodePipeline post-merge test & deployment
- [x] Bundle handlers using webpack
- [ ] Tree shaking?
- [ ] Move configs into DynamoDB table (with DAX?) and design API / front end for updating
- [ ] Make deployment more configurable - allow stack name / bucket name specification
- [ ] Create reusable response helpers
- [ ] Enforce code style - (eslint + prettier)
- [x] Commit infrastructure as code? - cloudformation / serverless framework
- [x] Unit tests
- [ ] Integration tests
- [ ] Performance / load testing
- [ ] Demo FE application
