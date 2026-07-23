import env from "./lib/env";
import { Hono } from "hono";
import { cors } from "hono/cors";
import mainRoutes from "./routes";
import { startScheduler } from "./scheduler";

const app = new Hono();

app.use("*", cors({
  origin: (origin) => origin || "",
  allowHeaders: ["Content-Type", "Authorization", "x-api-key"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));

app.route("/", mainRoutes);

startScheduler();

export default {
  fetch: app.fetch,
  port: env.PORT,
};
