import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hostra | Ditch",
  description:
    "Restaurant hospitality platform powering unforgettable guest experiences at Ditch.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
