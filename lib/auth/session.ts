import "server-only";
import { adminAuth } from "@/lib/firebase/admin";

export class UnauthorizedError extends Error {
  constructor() {
    super("Non authentifié");
    this.name = "UnauthorizedError";
  }
}

/** Verifies the Firebase ID token sent as `Authorization: Bearer <token>` and returns the uid. */
export async function requireUserId(request: Request): Promise<string> {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) throw new UnauthorizedError();

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    throw new UnauthorizedError();
  }
}
