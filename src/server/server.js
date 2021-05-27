require("dotenv").config();
const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
var enforce = require("express-sslify");
const Eta = require("eta");
const morgan = require("morgan");

const configureRoutes = require("./routes.js");
const initSockets = require("./socket.js");
const { initDb } = require("./store.js");
const initCron = require("./fake_cron.js");

/* main function */
async function run() {
  console.log("quick-pad starting");

  // Main app!
  var app = express();
  app.use(morgan("common"));
  app.set("port", process.env.PORT || 8080);

  if (process.env.NODE_ENV === "production") {
    app.use(enforce.HTTPS({ trustProtoHeader: true }));
  }

  app.use(bodyParser.json());
  app.use(express.static("public"));
  app.use(express.static("build"));
  Eta.config.views = "./src/client/templates";
  Eta.config.cache = process.env.NODE_ENV === "production";

  configureRoutes(app);
  await initDb();

  var server = http.createServer(app);
  initSockets(server);
  server.listen(app.get("port"), function () {
    initCron();
    console.log("Node app is running on port", app.get("port"));
  });
}

module.exports = run;
