import env from "./lib/env";
import { Hono } from "hono";
import mainRoutes from "./routes";

const app = new Hono();

app.route("/", mainRoutes);

export default {
  fetch: app.fetch,
  port: env.PORT,
};
