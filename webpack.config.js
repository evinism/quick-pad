module.exports = {
  context: __dirname + "/src/client/assets/js",
  entry: [ './index' ],
  output: {
    path: __dirname + "/build",
    filename: "application.js",
    publicPath: "/"
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [ '.js' ]
  },
  devtool: 'source-map'
}
