/**
 * Route aggregator – mounts all sub-routers under the main Hono app.
 *
 * Mount points:
 *   /auth/*          – Better Auth (auth, orgs, API keys, Polar)
 *   /products        – Polar.sh products listing
 *   /api/*           – Giveaway CRUD, page settings, upload, public endpoints
 */

import { Hono } from "hono";
import authRoutes from "./auth";
import productsRoutes from "./products";
import giveawaysRoutes from "./giveaways";
import publicGiveawaysRoutes from "./public-giveaways";
import publicPageRoutes from "./public-page";
import pagesRoutes from "./pages";
import uploadRoutes from "./upload";
import type { AuthVariables } from "../middlewares/auth";

const mainRoutes = new Hono<{ Variables: AuthVariables }>();

mainRoutes.route("/auth", authRoutes);
mainRoutes.route("/", productsRoutes);
mainRoutes.route("/api", giveawaysRoutes);
mainRoutes.route("/api", pagesRoutes);
mainRoutes.route("/api", uploadRoutes);
mainRoutes.route("/api", publicGiveawaysRoutes);
mainRoutes.route("/api", publicPageRoutes);

export default mainRoutes;
