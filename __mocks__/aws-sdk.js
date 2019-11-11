export const mockQuery = jest.fn();
export const mockPutItem = jest.fn();
export const mockUpdateItem = jest.fn();
export const mockInvoke = jest.fn();

const DynamoDB = jest.fn().mockImplementation(() => ({
  query: mockQuery,
  putItem: mockPutItem,
  updateItem: mockUpdateItem
}));

const Lambda = jest.fn().mockImplementation(() => ({
  invoke: mockInvoke
}));

const fakeAWSSDKInterface = {
  DynamoDB,
  Lambda
};

export default fakeAWSSDKInterface;
