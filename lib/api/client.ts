"use client";

import { auth } from "@/lib/firebase/client";

/** Calls one of our own API routes, attaching the current user's Firebase ID token. */
export async function callApi<T>(
  path: string,
  body?: unknown,
  method: "GET" | "POST" = "POST",
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Vous devez être connecté.");
  const token = await user.getIdToken();

  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Erreur (${res.status})`);
  }
  return data as T;
}
