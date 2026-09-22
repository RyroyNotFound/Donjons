import "server-only";
import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/lib/auth/session";

export class GameError extends Error {}

interface EmptyContext {
  params: Promise<Record<string, never>>;
}

/** Wraps a route handler: resolves the caller's uid, and converts thrown errors to JSON responses. */
export function withAuth<Context = EmptyContext>(
  handler: (uid: string, request: Request, context: Context) => Promise<NextResponse>,
) {
  return async (request: Request, context: Context) => {
    try {
      const uid = await requireUserId(request);
      return await handler(uid, request, context);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error instanceof GameError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      console.error(error);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
  };
}
