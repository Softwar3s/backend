import env from "./lib/env";
import { Hono } from "hono";
import { cors } from "hono/cors";
import mainRoutes from "./routes";

const app = new Hono();

app.use("*", cors({
  origin: (origin) => origin || "",
  allowHeaders: ["Content-Type", "Authorization", "x-api-key"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));

app.route("/", mainRoutes);

export default {
  fetch: app.fetch,
  port: env.PORT,
};
