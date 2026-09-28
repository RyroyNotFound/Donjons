import { PageTransition } from "@/components/PageTransition";
import { VeloursGame } from "@/components/velours/VeloursGame";

export default function VeloursPage() {
  return (
    <PageTransition>
      <VeloursGame />
    </PageTransition>
  );
}
