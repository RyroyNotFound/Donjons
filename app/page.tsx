"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/tableau-de-bord" : "/connexion");
  }, [user, loading, router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-zinc-400">Chargement...</p>
    </div>
  );
}
