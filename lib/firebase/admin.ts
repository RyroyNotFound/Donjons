import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | undefined;

/** Accepts the key however it was pasted into the env (Vercel dashboard, .env.local): copied
 *  straight from the service-account JSON with its surrounding quotes and trailing comma,
 *  with literal (or doubly escaped) \n, or with real line breaks. */
function normalizePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let key = raw.trim().replace(/,$/, "").trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}

function getAdminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Variables Firebase Admin manquantes (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY). Voir .env.local.example.",
    );
  }

  app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

// Lazy singletons: the admin SDK must not be initialized at module-load time,
// otherwise `next build`'s route data collection (which imports every route
// module) crashes before env vars are even relevant.
let cachedAuth: Auth | undefined;
let cachedDb: Firestore | undefined;

function lazyProxy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const instance = resolve();
      const value = Reflect.get(instance as object, prop, instance);
      return typeof value === "function" ? value.bind(instance) : value;
    },
  });
}

export const adminAuth: Auth = lazyProxy(() => {
  if (!cachedAuth) cachedAuth = getAuth(getAdminApp());
  return cachedAuth;
});

export const adminDb: Firestore = lazyProxy(() => {
  if (!cachedDb) {
    cachedDb = getFirestore(getAdminApp());
    // Game objects carry many optional fields (element, raidEffectTag, fellIn...) that are
    // often undefined; without this flag every such write throws. (firebase-admin's
    // initializeFirestore() silently drops this option, hence settings().) settings() throws
    // if the instance was already configured, which happens after a dev hot reload.
    try {
      cachedDb.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Already configured with the same settings.
    }
  }
  return cachedDb;
});
