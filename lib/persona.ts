// lib/persona.ts — client fetch wrapper that attaches auth + active persona to every request.
import { supabase } from "./supabase";

export async function apexFetch(url: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const persona = typeof window !== "undefined" ? localStorage.getItem("activePersonaId") : null;
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(persona ? { "X-Active-Persona": persona } : {}),
    },
  });
}
