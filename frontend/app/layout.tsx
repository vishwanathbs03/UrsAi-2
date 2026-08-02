import type { Metadata } from "next";
import { env } from "@/lib/env";
import { AuthProviderClient } from "@/components/auth/AuthProviderClient";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: `${env.appName} — AI-Powered Business Intelligence Platform`,
    template: `%s | ${env.appName}`,
  },
  description: `${env.appName} — AI-Powered Business Intelligence Platform for Enterprise MSMEs.`,
  metadataBase: new URL(env.appUrl),
  manifest: "/manifest.json",
  openGraph: {
    title: "UrsBiz — AI-Powered Business Intelligence Platform",
    description: "Enterprise Digital Twin, Business Health Scoring, AI Advisor & Analytics Platform.",
    url: env.appUrl,
    siteName: "UrsBiz",
    type: "website",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-FOUC: apply persisted theme before first paint.
            Must live here, not in a client effect, so the .dark
            class is in place before React hydrates. */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('ursbiz.theme');" +
              "if(t==='dark'||t==='light'){" +
              "document.documentElement.classList[t==='dark'?'add':'remove']('dark');" +
              "}else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){" +
              "document.documentElement.classList.add('dark');" +
              "}}catch(e){}})();",
          }}
        />
      </head>
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
