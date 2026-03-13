import type { Metadata } from "next";
import "./globals.css";  // ← this is missing

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}