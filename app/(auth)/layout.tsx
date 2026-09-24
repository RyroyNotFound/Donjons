import { Card } from "@/components/Card";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <p className="font-display text-gold-gradient text-3xl font-bold tracking-wide">⚔️ Donjons</p>
      <Card accent="gold" className="w-full max-w-sm">
        {children}
      </Card>
    </div>
  );
}
