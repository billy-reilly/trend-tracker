import { createPromiseCB } from "../promiseHelpers";

describe("createPromiseCB", () => {
  it("should reject if an error is returned", () => {
    const resolve = jest.fn();
    const reject = jest.fn();

    const error = new Error();

    expect(reject).not.toHaveBeenCalled();

    createPromiseCB(resolve, reject)(error);
    expect(reject).toHaveBeenCalledWith(error);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("should resolve if no error is returned", () => {
    const resolve = jest.fn();
    const reject = jest.fn();

    const data = { a: "b" };

    expect(resolve).not.toHaveBeenCalled();

    createPromiseCB(resolve, reject)(null, data);
    expect(resolve).toHaveBeenCalledWith(data);
    expect(reject).not.toHaveBeenCalled();
  });
});
