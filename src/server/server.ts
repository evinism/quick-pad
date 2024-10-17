import dotenv from "dotenv";
dotenv.config();

import http from "http";
import express from "express";
import enforce from "express-sslify";
import { config as etaConfig } from "eta";
import morgan from "morgan";
import session, { Store } from "express-session";
import passport from "passport";
import { createClient } from "redis";
import RedisStore from "connect-redis";
import "./passportconfig";

import configureRoutes from "./routes.js";
import initSockets from "./socket.js";
import initCron from "./fake_cron.js";

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

  app.use(express.json());

  let store: Store = new session.MemoryStore();
  if (process.env.NODE_ENV === "production" || true) {
    const redisClient = createClient({
      url: process.env.REDIS_URL,
    });
    redisClient.connect().catch(console.error);
    store = new RedisStore({
      client: redisClient,
    });
  }

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "bogus",
      resave: false,
      cookie: {
        expires: new Date(Date.now() + 365 * 86400 * 1000),
      },
      store,
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  app.use(express.static("public"));
  etaConfig.views = "./src/client/templates";
  etaConfig.cache = process.env.NODE_ENV === "production";

  configureRoutes(app);

  var server = http.createServer(app);
  initSockets(server);
  server.listen(app.get("port"), function () {
    initCron();
    console.log("Node app is running on port", app.get("port"));
  });
}

export default run;
