import type { Metadata } from "next";
import { env } from "@/lib/env";
import { AuthProviderClient } from "@/components/auth/AuthProviderClient";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: `${env.appName} — The intelligence layer for modern SMBs`,
    template: `%s | ${env.appName}`,
  },
  description: env.appName,
  metadataBase: new URL(env.appUrl),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <AuthProviderClient>{children}</AuthProviderClient>
      </body>
    </html>
  );
}
