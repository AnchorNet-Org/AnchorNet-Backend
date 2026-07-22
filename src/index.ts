/**
 * AnchorNet API – entry point.
 * Builds the application and starts the HTTP server.
 */

import { createApp, getConfig } from "./app";
import { createShutdownHandler } from "./utils/shutdown";
import { markNotReady } from "./utils/readiness";

const app = createApp();
const { port: PORT } = getConfig();

if (process.env.NODE_ENV !== "test") {
  const server = app.listen(PORT, () => {
    console.log(`AnchorNet API listening on http://localhost:${PORT}`);
  });

  const shutdown = createShutdownHandler(server, {
    onShutdown: (signal) => {
      markNotReady();
      console.log(`${signal} received, shutting down`);
    },
  });
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

export default app;
