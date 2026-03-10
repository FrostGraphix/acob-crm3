import { createApp } from "./app.js";
import { env } from "./services/env.js";

const app = createApp();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`ACOB CRM3 backend listening on http://localhost:${env.port}`);
});
