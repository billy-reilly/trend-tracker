export const createPromiseCB = (resolve, reject) => (err, data) => {
  if (err) {
    return reject(err);
  }
  resolve(data);
};
