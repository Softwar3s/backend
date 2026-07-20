import env from "../env";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schemas";

export default drizzle(env.DATABASE_URL);
export { schema };

