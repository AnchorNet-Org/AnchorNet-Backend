/**
 * AnchorNet API – entry point.
 * Builds the application and starts the HTTP server.
 */

import { createApp } from "./app";

const app = createApp();
const PORT = process.env.PORT ?? 3001;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`AnchorNet API listening on http://localhost:${PORT}`);
  });
}

export default app;
