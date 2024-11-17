const path = require('path');

module.exports = {
  entry: {
    background: './src/background.ts',
    'content-script': './src/content-script.ts', // Keep entry as 'content-script'
    popup: './src/popup.ts',

  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: (pathData) => {
      return '[name].js';
    },
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  optimization: {
    minimize: false,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  mode: 'production',
};
