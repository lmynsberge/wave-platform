import { buildApp } from "./app.js";
import { createPool } from "./db.js";

const coreUrl = process.env.CORE_URL ?? "http://localhost:8081";
const port = Number(process.env.PORT ?? 8080);

const app = buildApp({ coreUrl,
  webDist: process.env.WEB_DIST,
  secureCookies: process.env.COOKIE_SECURE === "1", pool: createPool() });
app
  .listen({ port, host: "0.0.0.0" })
  .then(() => console.log(`wave-server listening on ${port}, core at ${coreUrl}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
