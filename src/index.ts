/**
 * AnchorNet API – entry point.
 * Builds the application and starts the HTTP server.
 */

import { createApp } from "./app";
import { createShutdownHandler } from "./utils/shutdown";

const app = createApp();
const PORT = process.env.PORT ?? 3001;

if (process.env.NODE_ENV !== "test") {
  const server = app.listen(PORT, () => {
    console.log(`AnchorNet API listening on http://localhost:${PORT}`);
  });

  const shutdown = createShutdownHandler(server, {
    onShutdown: (signal) => console.log(`${signal} received, shutting down`),
  });
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

export default app;
