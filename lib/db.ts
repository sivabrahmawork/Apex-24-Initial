// lib/db.ts — single Drizzle/Postgres connection (Supabase connection string).
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!, { prepare: false }); // Supabase pooler-safe
export const db = drizzle(client, { schema });
