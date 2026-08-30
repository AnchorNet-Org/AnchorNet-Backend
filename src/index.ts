/**
 * AnchorNet API – entry point.
 * Builds the application and starts the HTTP server.
 */

import express, { Express } from "express";
import { createApp, getConfig } from "./app";
import { initializePersistence, PersistenceRuntime } from "./persistence/runtime";
import { createShutdownHandler } from "./utils/shutdown";
import { markNotReady } from "./utils/readiness";

let app: Express = express();

function listen(application: Express, runtime?: PersistenceRuntime): void {
  const { port: PORT } = getConfig();
  const server = application.listen(PORT, () => {
    console.log(`AnchorNet API listening on http://localhost:${PORT}`);
  });

  const shutdown = createShutdownHandler(server, {
    onShutdown: (signal) => {
      markNotReady();
      console.log(`${signal} received, shutting down`);
      if (runtime) void runtime.database.close();
    },
  });
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

async function start(): Promise<void> {
  const config = getConfig();
  if (config.databaseUrl) {
    const runtime = await initializePersistence(config);
    app = createApp({ persistence: runtime });
    listen(app, runtime);
    return;
  }

  app = createApp();
  listen(app);
}

if (process.env.NODE_ENV === "test") {
  // Tests import the app without binding a port.
  app = createApp();
} else {
  void start().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`AnchorNet API failed to start: ${message}`);
    process.exit(1);
  });
}

export default app;
