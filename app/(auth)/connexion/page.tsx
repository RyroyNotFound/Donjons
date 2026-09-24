"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/Button";
import { Label, inputClass } from "@/components/Field";
import { PageTransition } from "@/components/PageTransition";

export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetInfo, setResetInfo] = useState<string | null>(null);

  async function handleReset() {
    setError(null);
    setResetInfo(null);
    if (!email) {
      setError("Saisissez votre email ci-dessus, puis cliquez à nouveau sur « Mot de passe oublié ».");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
    } catch {
      // Same message either way: never reveal whether an account exists for this email.
    }
    setResetInfo(`Si un compte existe pour ${email}, un email de réinitialisation vient d'être envoyé (pensez aux spams).`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/tableau-de-bord");
    } catch {
      setError("Identifiants incorrects.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageTransition>
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-slate-50">Connexion</h1>
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <button type="button" onClick={handleReset} className="text-xs text-slate-400 hover:text-amber-400 hover:underline">
          Mot de passe oublié ?
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {resetInfo && <p className="text-sm text-emerald-400">{resetInfo}</p>}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Connexion..." : "Se connecter"}
        </Button>
      </form>
      <p className="text-sm text-slate-400">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="text-amber-400 hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
    </PageTransition>
  );
}
