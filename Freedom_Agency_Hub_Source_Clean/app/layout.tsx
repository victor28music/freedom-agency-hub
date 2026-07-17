import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Freedom Agency Hub",
  description: "Agency management system for Freedom Auto Insurance",
  manifest: "/manifest.webmanifest"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
