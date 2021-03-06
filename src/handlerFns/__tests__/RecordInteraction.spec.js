import mockDate from "mockdate";

import { handler as recordInteractionHandler } from "../RecordInteraction";
import {
  mockPutItem,
  mockUpdateItem,
  mockInvoke
} from "../../../__mocks__/aws-sdk";
import { getTrendListConfig } from "../../helpers/trendListConfigHelpers";

jest.mock("aws-xray-sdk-core", () => ({
  captureAWS: a => a
}));
jest.mock("aws-sdk");
jest.mock("../../helpers/trendListConfigHelpers");

const noop = jest.fn();

const fakeConfig = {
  aggregationWindow: 1
};
const fakeTimestamp = 1573495200000;
const fakeContext = {};
const fakeTrendListId = "shoes";
const fakeEvent = {
  queryStringParameters: {
    trendListId: fakeTrendListId
  },
  body: JSON.stringify({ itemId: "old boot" })
};
const trendingItemsResponse = {
  responseStatus: 200,
  body: {
    x: 100,
    y: 99,
    z: 4
  }
};
const fakeGetTrendingItemsResponse = {
  Payload: JSON.stringify(trendingItemsResponse)
};

describe("RecordInteraction", () => {
  let putParams;
  let updateParams;

  beforeAll(() => {
    mockDate.set(fakeTimestamp);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    putParams = undefined;
    updateParams = undefined;

    // mocks return expected values by default:
    mockPutItem.mockImplementation((params, cb) => {
      putParams = params;
      return cb(null, {});
    });
    mockUpdateItem.mockImplementation((params, cb) => {
      updateParams = params;
      return cb(null, {});
    });
    mockInvoke.mockImplementation((params, cb) => {
      return cb(null, fakeGetTrendingItemsResponse);
    });
  });

  it("should get the appropriate config from the TrendListConfigs table", () => {
    getTrendListConfig.mockResolvedValue(fakeConfig);

    return recordInteractionHandler(fakeEvent, fakeContext, noop).then(() => {
      expect(getTrendListConfig).toHaveBeenCalledWith(fakeTrendListId);
    });
  });

  describe("when the TrendListConfig is successfully retrieved", () => {
    beforeEach(() => {
      getTrendListConfig.mockResolvedValue(fakeConfig);
    });

    describe("record increment event", () => {
      it("should make a putItem request to dynamoDB", () => {
        return recordInteractionHandler(fakeEvent, fakeContext, noop).then(
          () => {
            expect(mockPutItem).toHaveBeenCalled();
            const expectedTimestamp =
              fakeTimestamp + fakeConfig.aggregationWindow * 60 * 1000;
            expect(putParams.Item.expirationTimestamp.N).toBe(
              expectedTimestamp.toString()
            );
            expect(putParams).toMatchSnapshot();
          }
        );
      });

      it("should handle the case where the put request fails", () => {
        const message = "dont put that there";
        const fakePutError = new Error(message);
        mockPutItem.mockImplementation((params, cb) => {
          putParams = params;
          return cb(fakePutError);
        });

        const mockCB = jest.fn();

        return recordInteractionHandler(fakeEvent, fakeContext, mockCB).then(
          () => {
            expect(mockPutItem).toHaveBeenCalled();
            expect(mockCB).toHaveBeenCalledWith(null, {
              statusCode: 500,
              body: `Error writing increment record: ${message}`
            });
            expect(mockCB).toHaveBeenCalledTimes(1);
            expect(mockUpdateItem).not.toHaveBeenCalled();
            expect(mockInvoke).not.toHaveBeenCalled();
          }
        );
      });
    });

    describe("increment item count", () => {
      it("should make an updateItem request to dynamoDB", () => {
        return recordInteractionHandler(fakeEvent, fakeContext, noop).then(
          () => {
            expect(mockUpdateItem).toHaveBeenCalled();
            expect(updateParams).toMatchSnapshot();
          }
        );
      });

      it("should handle the case where the updateItem request fails", () => {
        const message = "nope cant update that";
        const error = new Error(message);

        mockUpdateItem.mockImplementation((params, cb) => {
          updateParams = params;
          return cb(error);
        });

        const mockCB = jest.fn();

        return recordInteractionHandler(fakeEvent, fakeContext, mockCB).then(
          () => {
            expect(mockCB).toHaveBeenCalledTimes(1);
            expect(mockCB).toHaveBeenCalledWith(null, {
              statusCode: 500,
              body: `Error updating count: ${message}`
            });
            expect(mockInvoke).not.toHaveBeenCalled();
          }
        );
      });
    });

    describe("invoke GetTrendingItems", () => {
      it("should pass the correct trendListId and the config", () => {
        return recordInteractionHandler(fakeEvent, fakeContext, noop).then(
          () => {
            expect(mockInvoke).toHaveBeenCalledWith(
              {
                FunctionName: "GetTrendingItems",
                Payload: JSON.stringify({
                  queryStringParameters: {
                    trendListId: "shoes"
                  },
                  config: fakeConfig
                })
              },
              expect.any(Function)
            );
          }
        );
      });

      it("should correctly forward the response from GetTrendingItems if successful", () => {
        const mockCB = jest.fn();
        return recordInteractionHandler(fakeEvent, fakeContext, mockCB).then(
          () => {
            expect(mockCB).toHaveBeenCalledWith(null, trendingItemsResponse);
          }
        );
      });

      it("should handle the case where the invocation fails", () => {
        const message = "nope cant call that";
        const error = new Error(message);
        mockInvoke.mockImplementation((params, cb) => {
          return cb(error);
        });

        const mockCB = jest.fn();

        return recordInteractionHandler(fakeEvent, fakeContext, mockCB).then(
          () => {
            expect(mockCB).toHaveBeenCalledWith(null, {
              statusCode: 500,
              body: `Error invoking GetTrendingItems from RecordInteraction: ${message}`
            });
            expect(mockCB).toHaveBeenCalledTimes(1);
          }
        );
      });

      it("should handle the case where GetTrendingItems responds with unexpected response", () => {
        mockInvoke.mockImplementation((params, cb) => {
          return cb(null, {});
        });

        const mockCB = jest.fn();

        return recordInteractionHandler(fakeEvent, fakeContext, mockCB).then(
          () => {
            expect(mockCB).toHaveBeenCalledWith(null, {
              statusCode: 500,
              body: expect.stringMatching(
                "Error parsing response from GetTrendingItems:"
              )
            });
          }
        );
      });
    });
  });

  describe("when there is an error retrieving the TrendListConfig", () => {
    const message = "Misconfigured...";
    const fakeConfigError = new Error(message);
    beforeEach(() => {
      getTrendListConfig.mockRejectedValue(fakeConfigError);
    });

    it("should respond with the error and not attempt to update or get the list of trending items", () => {
      const mockCB = jest.fn();
      return recordInteractionHandler(fakeEvent, fakeContext, mockCB).then(
        () => {
          expect(mockCB).toHaveBeenCalledWith(null, {
            statusCode: 500,
            body: message
          });
          expect(mockPutItem).not.toHaveBeenCalled();
          expect(mockUpdateItem).not.toHaveBeenCalled();
          expect(mockInvoke).not.toHaveBeenCalled();
        }
      );
    });
  });
});
