import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createApi } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const host = process.env.HOST ?? "0.0.0.0";
const databasePath = process.env.DATABASE_PATH ?? resolve("data", "demo.sqlite");
const demoAccessKey = process.env.DEMO_ACCESS_KEY ?? null;
const allowInsecureDemoAuth = process.env.ALLOW_INSECURE_DEMO_AUTH === "1";

if (databasePath !== ":memory:") {
  mkdirSync(dirname(databasePath), { recursive: true });
}

const api = createApi({ databasePath, demoAccessKey, allowInsecureDemoAuth });
const address = await api.start(port, host);
console.log(`RALLY API listening on http://${host}:${address.port}`);
console.log(`SQLite database: ${databasePath}`);
if (!demoAccessKey) {
  console.warn("Demo session login is disabled because DEMO_ACCESS_KEY is not set.");
}
if (allowInsecureDemoAuth) {
  console.warn("Insecure x-demo-user-id authentication is enabled. Use only on a trusted local demo network.");
}

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await api.stop();
  process.exitCode = 0;
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);
