import { EmberField } from "@/components/EmberField";
import { BrandMark } from "@/components/BrandMark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100svh] flex-1 flex-col items-center justify-center px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <EmberField />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark size="lg" />
          <p className="max-w-xs text-sm text-fg-subtle">Défendez votre donjon, envoyez vos héros au combat.</p>
        </div>
        <div className="w-full rounded-2xl border border-line bg-surface/90 p-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.05),0_24px_48px_-12px_rgb(0_0_0/0.6)] backdrop-blur-sm sm:p-7">
          {children}
        </div>
      </div>
    </div>
  );
}
