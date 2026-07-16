import { Hono } from "hono";
import authRoutes from "./auth";
import type { AuthVariables } from "../middlewares/auth";

const mainRoutes = new Hono<{ Variables: AuthVariables }>();

mainRoutes.route("/auth", authRoutes);

export default mainRoutes;
