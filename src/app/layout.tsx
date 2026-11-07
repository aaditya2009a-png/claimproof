import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClaimProof",
  description: "Review marketing drafts against approved company facts before publication.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
