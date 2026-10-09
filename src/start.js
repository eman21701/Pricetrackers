import { Database } from "./Database.js";
import { PriceTrackersApplication } from "./server.js";

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const database = new Database();
const application = new PriceTrackersApplication(database);
application.start(port);
