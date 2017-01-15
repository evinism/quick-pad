require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const configureRoutes = require('./routes.js');
const initSockets = require('./socket.js');
const {dbInit} = require('./store.js');

/* main function */
function run() {
  console.log('quick-pad starting');

  // Main app!
  var app = express();
  app.set('port', (process.env.PORT || 8080));
  app.use(bodyParser.json());
  app.use(express.static('public'));
  configureRoutes(app);
  dbInit().then(() => {
    const server = app.listen(app.get('port'), function() {
      console.log('Node app is running on port', app.get('port'));
    });
    initSockets(server);
  })
}

module.exports = run;
