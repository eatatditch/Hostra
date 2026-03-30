import { TRPCProvider } from "@/lib/trpc/provider";
import { StaffNav } from "@/components/dashboard/staff-nav";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TRPCProvider>
      <div className="min-h-screen bg-surface">
        <StaffNav />
        <main className="pb-20 lg:pb-0 lg:pl-64">{children}</main>
      </div>
    </TRPCProvider>
  );
}
