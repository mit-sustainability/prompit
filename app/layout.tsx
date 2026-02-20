import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prompit",
  description: "Internal prompt gallery and voting hub"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
