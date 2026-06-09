import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Beyond the Loop — SuperZ",
  description: "Architecture Patterns for Reliable Agentic Systems — a 28-page technical document by SuperZ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0f] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
