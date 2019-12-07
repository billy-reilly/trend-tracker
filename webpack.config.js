const path = require("path");

module.exports = ({ initialisationFn, handlerFn } = {}) => {
  let entry = `./src/handlerFns/${handlerFn}.js`;
  let outputFilename = `${handlerFn}-bundle.js`;

  if (initialisationFn) {
    entry = `./src/initialisationFns/${initialisationFn}.js`;
    outputFilename = `${initialisationFn}-bundle.js`;
  }

  return {
    entry,
    mode: "production",
    output: {
      path: path.resolve(__dirname, "./dist/"),
      filename: outputFilename,
      libraryTarget: "commonjs"
    },
    target: "node",

    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /(node_modules)/,
          use: {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env"]
            }
          }
        }
      ]
    }
  };
};
