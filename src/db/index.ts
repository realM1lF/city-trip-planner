import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

const url =
  process.env.DATABASE_URL ??
  "postgresql://gmapsplanner_build:build@127.0.0.1:5432/gmapsplanner_build?sslmode=disable";

if (!process.env.DATABASE_URL) {
  console.warn(
    "[db] DATABASE_URL fehlt — bitte in .env.local / Netlify setzen. Verbindung schlägt zur Laufzeit fehl."
  );
}

const sql = neon(url);
export const db = drizzle(sql, { schema });
