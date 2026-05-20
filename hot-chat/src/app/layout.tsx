import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hot Chat",
  description: "Local chat transport client for Hot agent demos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
