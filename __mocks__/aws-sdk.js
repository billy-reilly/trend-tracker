const mockQuery = jest.fn();

const DynamoDB = jest.fn().mockImplementation(() => ({
  query: mockQuery
}));

module.exports = {
  DynamoDB,
  mockQuery
};
