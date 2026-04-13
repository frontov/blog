import type { Metadata } from "next";
import "./globals.css";

import { createRootMetadata } from "@/lib/site";

export const metadata: Metadata = createRootMetadata();

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
