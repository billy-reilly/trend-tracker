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

It also supports multiple lists so on our imaginary image sharing platform we could track the images with the most comments as well as the the most likes

## Service design

![service diagram](./service-diagram.png)

## TODOs:

- [ ] Clean out items with a count of 0 from `InteractionCounts` table
- [ ] Move configs into centralised place
- [ ] Use dynamodb transactions to prevent two tables becoming out of sync
- [ ] Commit infrastructure as code? - cloudformation / serverless framework
- [ ] Unit tests
- [ ] Integration tests
- [ ] Performance / load testing
- [ ] Demo FE application
