"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/Button";
import { Label, inputClass } from "@/components/Field";
import { PageTransition } from "@/components/PageTransition";

export default function InscriptionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/tableau-de-bord");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setError(
        code === "auth/email-already-in-use"
          ? "Un compte existe déjà avec cet email."
          : code === "auth/weak-password"
            ? "Mot de passe trop faible (6 caractères minimum)."
            : "Impossible de créer le compte.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-fg">Créer un compte</h1>
          <p className="text-sm text-fg-subtle">Quelques secondes et votre donjon vous attend.</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label>Email</Label>
            <input
              type="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <Label>Mot de passe</Label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? "Création..." : "Créer mon compte"}
          </Button>
        </form>
        <p className="text-center text-sm text-fg-subtle">
          Déjà un compte ?{" "}
          <Link href="/connexion" className="font-medium text-gold transition-colors duration-150 hover:text-gold-bright">
            Se connecter
          </Link>
        </p>
      </div>
    </PageTransition>
  );
}
