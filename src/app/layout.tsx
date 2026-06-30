import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moltbook Explorer",
  description: "Public analytics for the Moltbook agent ecosystem",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0f] text-[#e0e0e8] antialiased">
        {children}
      </body>
    </html>
  );
}