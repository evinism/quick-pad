const path = require("path");

module.exports = {
  entry: { main: "./src/client/assets/js" },
  output: {
    path: __dirname + "/build",
    filename: "application.js",
    publicPath: "/"
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader"
        }
      }
    ]
  }
};
