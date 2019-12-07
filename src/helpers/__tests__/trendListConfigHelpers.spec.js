import { getTrendListConfig } from "../trendListConfigHelpers";

import { mockGetItem } from "../../../__mocks__/aws-sdk";

jest.mock("aws-xray-sdk-core", () => ({
  captureAWS: a => a
}));
jest.mock("aws-sdk");

const fakeId = "x";

const rawConfigData = {
  Item: {
    trendListLimit: {
      N: "10"
    },
    aggregationWindow: {
      N: "60000"
    }
  }
};
const expectedConfig = {
  trendListLimit: "10",
  aggregationWindow: 60000
};
const misshapenConfigData = {
  Item: {
    a: {
      S: "b"
    }
  }
};

describe("getTrendListConfig", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should try to get an item with the matching ID from the TrendListConfig table", () => {
    let queryParams;
    mockGetItem.mockImplementation((params, cb) => {
      queryParams = params;
      cb(null, rawConfigData);
    });

    return getTrendListConfig(fakeId).then(() => {
      expect(mockGetItem).toHaveBeenCalled();
      expect(queryParams).toEqual({
        TableName: "TrendListConfigs",
        Key: {
          trendListId: {
            S: fakeId
          }
        }
      });
    });
  });

  describe("if the ID provided matches an item in the config table", () => {
    describe("and the config item is of the expected shape", () => {
      it("should return the formatted config object", () => {
        mockGetItem.mockImplementation((params, cb) => {
          cb(null, rawConfigData);
        });

        return getTrendListConfig(fakeId).then(data => {
          expect(data).toEqual(expectedConfig);
        });
      });
    });

    describe("and the config item is of an unexpected shape", () => {
      it("should throw an error", () => {
        mockGetItem.mockImplementation((params, cb) => {
          cb(null, misshapenConfigData);
        });

        expect.assertions(1);
        return getTrendListConfig(fakeId).catch(err => {
          expect(err.message).toMatch(
            `TrendListConfig data of unexpected shape for ${fakeId}:`
          );
        });
      });
    });
  });

  describe("if the ID provided does not match an item in the config table", () => {
    const missingConfigData = {};

    it('should attempt to get the "default" config', () => {
      let params1;
      let params2;
      mockGetItem.mockImplementationOnce((params, cb) => {
        params1 = params;
        cb(null, missingConfigData);
      });
      mockGetItem.mockImplementation((params, cb) => {
        params2 = params;
        cb(null, rawConfigData);
      });

      return getTrendListConfig(fakeId).then(() => {
        expect(mockGetItem).toHaveBeenCalledTimes(2);
        expect(params1.Key.trendListId.S).toEqual(fakeId);
        expect(params2.Key.trendListId.S).toEqual("default");
      });
    });

    describe("and if the default config exists and is valid", () => {
      it("should return the default config", () => {
        mockGetItem.mockImplementationOnce((params, cb) => {
          cb(null, missingConfigData);
        });
        mockGetItem.mockImplementation((params, cb) => {
          if (params.Key.trendListId.S === "default") {
            cb(null, rawConfigData);
          }
          cb(null, undefined);
        });

        return getTrendListConfig(fakeId).then(data => {
          expect(data).toEqual(expectedConfig);
        });
      });
    });

    describe("and if the default config is misshapen", () => {
      it("should throw an error", () => {
        mockGetItem.mockImplementationOnce((params, cb) => {
          cb(null, missingConfigData);
        });
        mockGetItem.mockImplementation((params, cb) => {
          cb(null, misshapenConfigData);
        });

        expect.assertions(1);
        return getTrendListConfig(fakeId).catch(err => {
          expect(err.message).toMatch(
            "TrendListConfig data of unexpected shape for default:"
          );
        });
      });
    });

    describe("and if the default config is missing", () => {
      it("should throw an error", () => {
        mockGetItem.mockImplementation((params, cb) => {
          cb(null, missingConfigData);
        });

        expect.assertions(2);
        return getTrendListConfig(fakeId).catch(err => {
          expect(mockGetItem).toHaveBeenCalledTimes(2);
          expect(err.message).toMatch("TrendListConfig not found for default");
        });
      });
    });
  });
});
