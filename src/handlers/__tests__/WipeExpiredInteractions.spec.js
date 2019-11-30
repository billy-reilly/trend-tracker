import mockDate from "mockdate";

import { handler as wipeExpiredInteractionsHandler } from "../WipeExpiredInteractions";
import {
  mockScan,
  mockUpdateItem,
  mockDeleteItem
} from "../../__mocks__/aws-sdk";

jest.mock("aws-xray-sdk-core", () => ({
  captureAWS: a => a
}));
jest.mock("aws-sdk");

const noop = () => {};

const fakeTimestamp = 1573495200000;
const fakeEvent = {};
const fakeContext = {};
const fakeScanData = {
  Items: [
    {
      itemId: {
        S: "old boot"
      },
      trendListId: {
        S: "shoes"
      },
      expirationTimestamp: {
        N: "1573490000000"
      }
    },
    {
      itemId: {
        S: "flip flop"
      },
      trendListId: {
        S: "shoes"
      },
      expirationTimestamp: {
        N: "1573490000000"
      }
    }
  ]
};

describe("WipeExpiredInteractions", () => {
  let scanParams;

  beforeAll(() => {
    mockDate.set(fakeTimestamp);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    scanParams = undefined;

    // mocks return expected values by default:
    mockScan.mockImplementation((params, cb) => {
      scanParams = params;
      return cb(null, fakeScanData);
    });
    mockUpdateItem.mockImplementation((params, cb) => cb(null));
    mockDeleteItem.mockImplementation((params, cb) => cb(null));
  });

  it("should scan the Interactions table for expired interaction records", () => {
    return wipeExpiredInteractionsHandler(fakeEvent, fakeContext, noop).then(
      () => {
        expect(mockScan).toHaveBeenCalled();
        expect(scanParams).toMatchObject({
          TableName: "Interactions",
          FilterExpression: "expirationTimestamp < :now",
          ExpressionAttributeValues: {
            ":now": {
              N: fakeTimestamp.toString()
            }
          }
        });
      }
    );
  });

  it("should handle the case where data from the scan is of an unexpected shape", () => {
    mockScan.mockImplementation((params, cb) =>
      cb(null, {
        x: "y"
      })
    );

    const mockCB = jest.fn();

    return wipeExpiredInteractionsHandler(fakeEvent, fakeContext, mockCB).then(
      () => {
        expect(mockCB).toHaveBeenCalledWith(null, {
          statusCode: 500,
          body: expect.stringMatching("Error formatting data")
        });
      }
    );
  });

  describe("if there are expired interactions", () => {
    const createUpdateItemParams = itemId => ({
      TableName: "InteractionCounts",
      Key: {
        itemId: {
          S: itemId
        },
        trendListId: {
          S: "shoes"
        }
      },
      UpdateExpression:
        "set interactionCount = if_not_exists(interactionCount, :one) - :dec",
      ExpressionAttributeValues: {
        ":dec": { N: "1" },
        ":one": { N: "1" }
      }
    });

    it("should decrement the interactionCount for expired interaction record", () => {
      return wipeExpiredInteractionsHandler(fakeEvent, fakeContext, noop).then(
        () => {
          expect(mockUpdateItem).toHaveBeenCalledTimes(2);
          expect(mockUpdateItem).toHaveBeenCalledWith(
            createUpdateItemParams("old boot"),
            expect.any(Function)
          );
          expect(mockUpdateItem).toHaveBeenCalledWith(
            createUpdateItemParams("flip flop"),
            expect.any(Function)
          );
        }
      );
    });

    const createDeleteItemParams = itemId => ({
      TableName: "Interactions",
      Key: {
        itemId: {
          S: itemId
        },
        expirationTimestamp: {
          N: "1573490000000"
        }
      }
    });

    it("should delete each expired interaction record", () => {
      return wipeExpiredInteractionsHandler(fakeEvent, fakeContext, noop).then(
        () => {
          expect(mockDeleteItem).toHaveBeenCalledTimes(2);
          expect(mockDeleteItem).toHaveBeenCalledWith(
            createDeleteItemParams("old boot"),
            expect.any(Function)
          );
          expect(mockDeleteItem).toHaveBeenCalledWith(
            createDeleteItemParams("flip flop"),
            expect.any(Function)
          );
        }
      );
    });

    it("should handle the case where an updateItem request fails", () => {
      const message = "no way cant update that";
      const error = new Error(message);
      mockUpdateItem.mockImplementation((params, cb) => cb(error));

      const mockCB = jest.fn();

      return wipeExpiredInteractionsHandler(
        fakeEvent,
        fakeContext,
        mockCB
      ).then(() => {
        expect(mockCB).toHaveBeenCalledWith(null, {
          statusCode: 500,
          body: `Error in removal promise chain ${message}`
        });
      });
    });

    it("should handle the case where a deleteItem request fails", () => {
      const message = "no way cant delete that";
      const error = new Error(message);
      mockDeleteItem.mockImplementation((params, cb) => cb(error));

      const mockCB = jest.fn();

      return wipeExpiredInteractionsHandler(
        fakeEvent,
        fakeContext,
        mockCB
      ).then(() => {
        expect(mockCB).toHaveBeenCalledWith(null, {
          statusCode: 500,
          body: `Error in removal promise chain ${message}`
        });
      });
    });

    it("should return a successful response if all operations are successful", () => {
      const mockCB = jest.fn();

      return wipeExpiredInteractionsHandler(
        fakeEvent,
        fakeContext,
        mockCB
      ).then(() => {
        expect(mockCB).toHaveBeenCalledWith(null, {
          statusCode: 200,
          body: "HAS REMOVED INTERACTIONS: YES"
        });
      });
    });
  });

  describe("if there are no expired interactions", () => {
    const fakeScanDataNoExpiredItems = { Items: [] };
    beforeEach(() => {
      mockScan.mockImplementation((params, cb) => {
        scanParams = params;
        return cb(null, fakeScanDataNoExpiredItems);
      });
    });

    it("should return a successful response if all operations are successful", () => {
      const mockCB = jest.fn();

      return wipeExpiredInteractionsHandler(
        fakeEvent,
        fakeContext,
        mockCB
      ).then(() => {
        expect(mockCB).toHaveBeenCalledWith(null, {
          statusCode: 200,
          body: "HAS REMOVED INTERACTIONS: NO"
        });
      });
    });
  });
});
