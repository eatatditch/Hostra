import { TRPCProvider } from "@/lib/trpc/provider";
import { LandingContent } from "@/components/shared/landing-content";

export default function HomePage() {
  return (
    <TRPCProvider>
      <LandingContent />
    </TRPCProvider>
  );
}
