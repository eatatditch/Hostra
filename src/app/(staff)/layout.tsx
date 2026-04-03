import { TRPCProvider } from "@/lib/trpc/provider";
import { LocationProvider } from "@/components/dashboard/location-provider";
import { StaffNav } from "@/components/dashboard/staff-nav";
import { StaffRefreshWrapper } from "@/components/shared/staff-refresh-wrapper";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TRPCProvider>
      <LocationProvider>
        <div className="min-h-screen bg-surface">
          <StaffNav />
          <main className="pt-12 pb-16 overflow-hidden" style={{ height: "100dvh" }}>
            <StaffRefreshWrapper>{children}</StaffRefreshWrapper>
          </main>
        </div>
      </LocationProvider>
    </TRPCProvider>
  );
}
