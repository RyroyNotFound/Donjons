"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/Button";
import { Label, inputClass } from "@/components/Field";
import { PageTransition } from "@/components/PageTransition";
import { focusRing } from "@/lib/ui/a11y";

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
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-fg">Connexion</h1>
          <p className="text-sm text-fg-subtle">Reprenez la défense de votre donjon.</p>
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
            <div className="flex items-baseline justify-between gap-3">
              <Label>Mot de passe</Label>
              <button
                type="button"
                onClick={handleReset}
                className={`mb-1.5 rounded text-xs text-gold transition-colors duration-150 hover:text-gold-bright ${focusRing}`}
              >
                Mot de passe oublié ?
              </button>
            </div>
            <input
              type="password"
              required
              autoComplete="current-password"
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
          {resetInfo && (
            <p
              role="status"
              className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300"
            >
              {resetInfo}
            </p>
          )}
          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
        <p className="text-center text-sm text-fg-subtle">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-medium text-gold transition-colors duration-150 hover:text-gold-bright">
            Créer un compte
          </Link>
        </p>
      </div>
    </PageTransition>
  );
}
