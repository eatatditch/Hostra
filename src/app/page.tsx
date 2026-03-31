import Link from "next/link";
import { HostOSLogoStatic as HostOSLogo } from "@/components/ui/hostos-logo";

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="flex flex-col items-center space-y-6 px-4">
        <HostOSLogo height={48} />
        <p className="text-lg text-text-muted max-w-md mx-auto">
          Powered by GuestIQ
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link
            href="/reserve"
            className="px-6 py-3 bg-primary text-text-inverse rounded-lg font-semibold hover:bg-primary-hover transition-colors"
          >
            Make a Reservation
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 bg-secondary text-text-inverse rounded-lg font-semibold hover:bg-secondary-hover transition-colors"
          >
            Staff Login
          </Link>
        </div>
      </div>
    </div>
  );
}
