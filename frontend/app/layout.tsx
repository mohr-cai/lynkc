import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "lynkc",
  description: "Hacky clipboard tunnel that syncs your clipboard via the browser"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
