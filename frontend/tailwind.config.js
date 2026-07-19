const path = require('node:path');

module.exports = {
  content: [
    path.join(__dirname, 'src/**/*.{vue,js}'),
    path.join(__dirname, '../public/index.html'),
    path.join(__dirname, '../public/app.js'),
  ],
  theme: { extend: {} },
  plugins: [],
};
