const path = require('path');

module.exports = {
  entry: {
    background: './src/background.ts',
    'content-script': './src/content-script.ts',  // Keep entry as 'content-script'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: (pathData) => {
      // Check if the chunk name is 'content-script' and ensure correct output name
      if (pathData.chunk.name === 'content-script') {
        return 'content-script.js';  // Output 'content-script.js' for the content script
      }
      // For other scripts, keep the default [name].js naming
      return '[name].js';
    },
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  optimization: {
    minimize: false
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
