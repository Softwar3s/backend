import { Hono } from "hono";
import authRoutes from "./auth";
import productsRoutes from "./products";
import type { AuthVariables } from "../middlewares/auth";

const mainRoutes = new Hono<{ Variables: AuthVariables }>();

mainRoutes.route("/auth", authRoutes);
mainRoutes.route("/", productsRoutes);

export default mainRoutes;
