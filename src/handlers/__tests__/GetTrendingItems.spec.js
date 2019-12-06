import { handler as getTrendingItemsHandler } from "../GetTrendingItems";
import { mockQuery } from "../../../__mocks__/aws-sdk";
import { getTrendListConfig } from "../../helpers/trendListConfigHelpers";

jest.mock("aws-xray-sdk-core", () => ({
  captureAWS: a => a
}));
jest.mock("aws-sdk");
jest.mock("../../helpers/trendListConfigHelpers");

const noop = () => {};

const fakeConfig = {
  trendListLimit: "10"
};
const fakeContext = {};
const fakeTrendListId = "shoes";
const fakeEvent = {
  queryStringParameters: {
    trendListId: fakeTrendListId
  }
};
const fakeQueryData = {
  Items: [
    {
      itemId: { S: "flip flops" },
      interactionCount: { N: "12345" }
    },
    {
      itemId: { S: "old boot" },
      interactionCount: { N: "4" }
    }
  ]
};

describe("GetTrendingItems", () => {
  beforeEach(() => {
    jest.resetAllMocks();

    mockQuery.mockImplementation((params, cb) => {
      cb(null, fakeQueryData);
    });
    getTrendListConfig.mockResolvedValue(fakeConfig);
  });

  describe("when the event does not contain the config", () => {
    it("should get the appropriate config from the TrendListConfigs table", () => {
      return getTrendingItemsHandler(fakeEvent, fakeContext, noop).then(() => {
        expect(getTrendListConfig).toHaveBeenCalledWith(fakeTrendListId);
        expect(mockQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            Limit: fakeConfig.trendListLimit
          }),
          expect.any(Function)
        );
      });
    });
  });

  describe("when the event does contain the config", () => {
    const forwardedConfig = { trendListLimit: "999" };
    const fakeEventWithConfig = {
      ...fakeEvent,
      config: forwardedConfig
    };

    it("should use the forwarded config rather than reading from the TrendListConfigs table", () => {
      return getTrendingItemsHandler(
        fakeEventWithConfig,
        fakeContext,
        noop
      ).then(() => {
        expect(getTrendListConfig).not.toHaveBeenCalled();
        expect(mockQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            Limit: forwardedConfig.trendListLimit
          }),
          expect.any(Function)
        );
      });
    });
  });

  describe("when the TrendListConfig is successfully retrieved", () => {
    it("should query DynamoDB", () => {
      let queryParams;
      mockQuery.mockImplementation((params, cb) => {
        queryParams = params;
        cb(null, fakeQueryData);
      });

      return getTrendingItemsHandler(fakeEvent, fakeContext, noop).then(() => {
        expect(mockQuery).toHaveBeenCalled();
        expect(queryParams).toMatchSnapshot();
      });
    });

    it("should correctly format the query data and respond", () => {
      const cbMock = jest.fn();
      return getTrendingItemsHandler(fakeEvent, fakeContext, cbMock).then(
        () => {
          expect(cbMock).toHaveBeenCalledWith(null, {
            statusCode: 200,
            body: JSON.stringify({
              "flip flops": 12345,
              "old boot": 4
            })
          });
        }
      );
    });

    it("should handle the case where the query data is of an unexpected shape", () => {
      const unexpectedQueryData = {
        Items: [
          {
            partitionKey: { S: "x" },
            attribute: { N: "1" }
          },
          {
            partitionKey: { S: "y" },
            attribute: { N: "2" }
          }
        ]
      };
      mockQuery.mockImplementation((params, cb) => {
        cb(null, unexpectedQueryData);
      });
      const cbMock = jest.fn();
      return getTrendingItemsHandler(fakeEvent, fakeContext, cbMock).then(
        () => {
          expect(cbMock).toHaveBeenCalledWith(null, {
            statusCode: 500,
            body:
              "Error formatting responseBody: Cannot read property 'S' of undefined"
          });
        }
      );
    });

    it("should handle the case where the db query fails", () => {
      const message = "ProvisionedThroughputExceededException or something";
      const fakeQueryError = new Error(message);
      mockQuery.mockImplementation((params, cb) => {
        cb(fakeQueryError);
      });
      const cbMock = jest.fn();
      return getTrendingItemsHandler(fakeEvent, fakeContext, cbMock).then(
        () => {
          expect(cbMock).toHaveBeenCalledWith(null, {
            statusCode: 500,
            body: `Error reading from dynamodb: ${message}`
          });
        }
      );
    });
  });

  describe("when there is an error retrieving the TrendListConfig", () => {
    const message = "Misconfigured...";
    const fakeConfigError = new Error(message);
    beforeEach(() => {
      getTrendListConfig.mockRejectedValue(fakeConfigError);
    });

    it("should respond with the error and not attempt to get the list of trending items", () => {
      const mockCB = jest.fn();
      return getTrendingItemsHandler(fakeEvent, fakeContext, mockCB).then(
        () => {
          expect(mockCB).toHaveBeenCalledWith(null, {
            statusCode: 500,
            body: message
          });
          expect(mockQuery).not.toHaveBeenCalled();
        }
      );
    });
  });
});
