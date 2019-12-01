const path = require("path");

module.exports = ({ customResource, handler } = {}) => {
  let entry = `./src/handlers/${handler}.js`;
  let outputFilename = `${handler}-bundle.js`;

  if (customResource) {
    entry = `./src/customResources/${customResource}.js`;
    outputFilename = `${customResource}-bundle.js`;
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
