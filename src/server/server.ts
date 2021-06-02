import dotenv from "dotenv";
import http from "http";
import express from "express";
import enforce from "express-sslify";
import { config as etaConfig } from "eta";
import morgan from "morgan";

import configureRoutes from "./routes.js";
import initSockets from "./socket.js";
import { initDb } from "./store.js";
import initCron from "./fake_cron.js";

/* main function */
async function run() {
  dotenv.config();
  console.log("quick-pad starting");

  // Main app!
  var app = express();
  app.use(morgan("common"));
  app.set("port", process.env.PORT || 8080);

  if (process.env.NODE_ENV === "production") {
    app.use(enforce.HTTPS({ trustProtoHeader: true }));
  }

  app.use(express.json());
  app.use(express.static("public"));
  etaConfig.views = "./src/client/templates";
  etaConfig.cache = process.env.NODE_ENV === "production";

  configureRoutes(app);
  await initDb();

  var server = http.createServer(app);
  initSockets(server);
  server.listen(app.get("port"), function () {
    initCron();
    console.log("Node app is running on port", app.get("port"));
  });
}

export default run;
