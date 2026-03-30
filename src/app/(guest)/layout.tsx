import { TRPCProvider } from "@/lib/trpc/provider";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TRPCProvider>
      <div className="min-h-screen bg-surface">{children}</div>
    </TRPCProvider>
  );
}
