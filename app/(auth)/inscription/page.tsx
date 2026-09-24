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
      <h1 className="font-display text-2xl font-bold text-slate-50">Créer un compte</h1>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label>Email</Label>
          <input
            type="email"
            required
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Création..." : "Créer mon compte"}
        </Button>
      </form>
      <p className="text-sm text-slate-400">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="text-amber-400 hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
    </PageTransition>
  );
}
