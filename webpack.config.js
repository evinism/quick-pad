export default {
  entry: { main: "./src/client/assets/js" },
  output: {
    path: process.cwd() + "/build",
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
