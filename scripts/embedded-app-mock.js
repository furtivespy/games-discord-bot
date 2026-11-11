#!/usr/bin/env bun
"use strict";

if (String(process.env.NODE_ENV || "").trim().toLowerCase() === "production") {
  console.error(
    "Refusing to start embedded app mock mode when NODE_ENV=production."
  );
  process.exit(1);
}

process.env.EMBEDDED_APP_MOCK = process.env.EMBEDDED_APP_MOCK || "1";
if (!String(process.env.CLIENT_ID || "").trim()) {
  process.env.CLIENT_ID = "mock-client-id";
}

const { startEmbeddedAppServer } = require("../modules/embeddedApp");

const { config, server } = startEmbeddedAppServer({
  logger: {
    log(message, type) {
      const tag = type ? `[${type}]` : "[info]";
      console.log(`${tag} ${message}`);
    },
  },
});

const port = config.port;
console.log(
  `Mock visual mode: http://127.0.0.1:${port}/?fixture=populated`
);
console.log(`  no-game:        http://127.0.0.1:${port}/?fixture=no-game`);
console.log(
  `  not-a-player:   http://127.0.0.1:${port}/?fixture=not-a-player`
);

server?.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
