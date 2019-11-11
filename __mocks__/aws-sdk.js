export const mockQuery = jest.fn();

const DynamoDB = jest.fn().mockImplementation(() => ({
  query: mockQuery
}));

const fakeAWSSDKInterface = {
  DynamoDB
};

export default fakeAWSSDKInterface;
