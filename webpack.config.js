const path = require("path");

module.exports = ({ handler } = {}) => ({
  entry: `./handlers/${handler}.js`,
  mode: "production",
  output: {
    path: path.resolve(__dirname, "./dist/"),
    filename: `${handler}-bundle.js`,
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
});
