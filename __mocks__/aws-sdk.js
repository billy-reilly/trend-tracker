/**
 * DynamoDB
 */
export const mockQuery = jest.fn();
export const mockPutItem = jest.fn();
export const mockUpdateItem = jest.fn();
export const mockDeleteItem = jest.fn();
export const mockScan = jest.fn();

const DynamoDB = jest.fn().mockImplementation(() => ({
  query: mockQuery,
  putItem: mockPutItem,
  updateItem: mockUpdateItem,
  deleteItem: mockDeleteItem,
  scan: mockScan
}));

/**
 * Lambda
 */
export const mockInvoke = jest.fn();

const Lambda = jest.fn().mockImplementation(() => ({
  invoke: mockInvoke
}));

/**
 * SDK interface
 */
const fakeAWSSDKInterface = {
  DynamoDB,
  Lambda
};

export default fakeAWSSDKInterface;
