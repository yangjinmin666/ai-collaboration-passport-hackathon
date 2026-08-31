import { createApi } from "../src/app.js";

const port = Number.parseInt(process.env.PORT ?? "0", 10);
const api = createApi({
  databasePath: ":memory:",
  emailSecret: "browser-email-secret",
  emailSender: async () => {},
  emailCodeGenerator: () => "246810",
  demoAccessKey: "browser-demo-access-key",
});
const address = await api.start(port, "127.0.0.1");
console.log(`Email live-test API listening on ${address.port}`);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await api.stop();
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);
