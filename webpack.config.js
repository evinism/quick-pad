module.exports = {
  entry: { main: "./build/client/assets/js/application" },
  output: {
    path: process.cwd() + "/public/build",
    filename: "application.js",
    publicPath: "/",
  },
  resolve: {
    fallback: {
      util: require.resolve("util/"),
      buffer: require.resolve("buffer/"),
      process: require.resolve("process/browser"),
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
      },
    ],
  },
};
