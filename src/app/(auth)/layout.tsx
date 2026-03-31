import { TRPCProvider } from "@/lib/trpc/provider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TRPCProvider>{children}</TRPCProvider>;
}
