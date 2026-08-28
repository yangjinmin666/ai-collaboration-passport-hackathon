import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createApi } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const host = process.env.HOST ?? "0.0.0.0";
const databasePath = process.env.DATABASE_PATH ?? resolve("data", "demo.sqlite");

if (databasePath !== ":memory:") {
  mkdirSync(dirname(databasePath), { recursive: true });
}

const api = createApi({ databasePath });
const address = await api.start(port, host);
console.log(`Collaboration Passport API listening on http://${host}:${address.port}`);
console.log(`SQLite database: ${databasePath}`);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await api.stop();
  process.exitCode = 0;
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);
