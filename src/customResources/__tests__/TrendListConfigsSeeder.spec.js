import { handler as trendConfigsTableSeeder } from "../TrendListConfigsSeeder";
import { send } from "../../helpers/customResourceResponder";

import { mockPutItem } from "../../../__mocks__/aws-sdk";

jest.mock("../../helpers/customResourceResponder");

const fakeContext = {
  logStreamName: "seeder_logs"
};

describe("TrendListConfigsSeeder", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    send.mockResolvedValue();
  });
  describe("when the event has RequestType Create", () => {
    const event = { RequestType: "Create" };

    it("should put the default config into the TrendListConfigs table", () => {
      let putParams;
      mockPutItem.mockImplementation((params, cb) => {
        putParams = params;
        cb(null, {});
      });
      return trendConfigsTableSeeder(event, fakeContext).then(() => {
        expect(mockPutItem).toHaveBeenCalled();
        expect(putParams.TableName).toBe("TrendListConfigs");
        expect(putParams.Item.trendListId.S).toBe("default");
      });
    });

    describe("if the default config is put successfully", () => {
      it("should send success response to the custom resource", () => {
        mockPutItem.mockImplementation((params, cb) => {
          cb(null, {});
        });
        return trendConfigsTableSeeder(event, fakeContext).then(() => {
          expect(send).toHaveBeenCalledWith(event, fakeContext, "SUCCESS", {
            Message: "Successfully seeded TrendListConfigs table"
          });
        });
      });
    });

    describe("if there is an error putting the default config", () => {
      it("should send failure response to the custom resource", () => {
        const message = "you cant put that there m8";
        const error = new Error(message);
        mockPutItem.mockImplementation((params, cb) => {
          cb(error);
        });
        return trendConfigsTableSeeder(event, fakeContext).then(() => {
          expect(send).toHaveBeenCalledWith(event, fakeContext, "FAILED", {
            Message: `Error seeding TrendListConfigs table: ${message}`
          });
        });
      });
    });
  });

  describe("when the event has RequestType other than Create", () => {
    const event = { RequestType: "Delete" };

    it("should send success response to the custom resource", () => {
      return trendConfigsTableSeeder(event, fakeContext).then(() => {
        expect(mockPutItem).not.toHaveBeenCalled();
        expect(send).toHaveBeenCalledWith(event, fakeContext, "SUCCESS", {
          Message: "Custom resource request not of type Create"
        });
      });
    });
  });
});
