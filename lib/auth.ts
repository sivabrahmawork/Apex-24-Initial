// lib/auth.ts — server-side auth helpers for route handlers.
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "./db";
import { sql } from "drizzle-orm";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function requireUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) throw Object.assign(new Error("unauthenticated"), { status: 401 });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error("unauthenticated"), { status: 401 });
  return { id: data.user.id, email: data.user.email! };
}

export async function requireEditor(req: NextRequest) {
  const user = await requireUser(req);
  const [row] = (await db.execute(sql`select is_editor from users where id = ${user.id}`)) as any[];
  if (!row?.is_editor) throw Object.assign(new Error("editor access required"), { status: 403 });
  return user;
}

// Resolve the ACTIVE persona for a write (client sends X-Active-Persona; ownership verified).
export async function requirePersona(req: NextRequest) {
  const user = await requireUser(req);
  const personaId = req.headers.get("x-active-persona");
  if (!personaId) throw Object.assign(new Error("no active persona"), { status: 400 });
  const [p] = (await db.execute(sql`
    select id from personas where id = ${personaId} and user_id = ${user.id}`)) as any[];
  if (!p) throw Object.assign(new Error("persona does not belong to user"), { status: 403 });
  return { user, personaId };
}
