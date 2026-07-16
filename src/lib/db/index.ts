import env from "../env";
import { drizzle } from "drizzle-orm/node-postgres";

export default drizzle(env.DATABASE_URL);
