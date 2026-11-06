import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const g = globalThis as unknown as { __wcSql?: ReturnType<typeof postgres> };
const sql = g.__wcSql ?? postgres(url, { max: 10 });
if (process.env.NODE_ENV !== "production") g.__wcSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
export * from "./schema";
