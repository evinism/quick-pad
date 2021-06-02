module.exports = {
  entry: { main: "./build/client/assets/js/application" },
  output: {
    path: process.cwd() + "/public/build",
    filename: "application.js",
    publicPath: "/",
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
    ],
  },
};
