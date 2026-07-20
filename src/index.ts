import env from "./lib/env";
import { Hono } from "hono";
import { cors } from "hono/cors";
import mainRoutes from "./routes";

const app = new Hono();

app.use("*", cors({
  origin: [process.env.FRONTEND_URL || "http://localhost:3000"],
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));

app.route("/", mainRoutes);

export default {
  fetch: app.fetch,
  port: env.PORT,
};
