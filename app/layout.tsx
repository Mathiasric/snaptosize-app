import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Suspense } from "react";
import { PostHogProvider } from "./components/PostHogProvider";
import { QuotaProvider } from "./app/context/QuotaContext";
import { PartnerRefCapture } from "./components/PartnerRefCapture";
import { Header } from "./components/Header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SnapToSize",
  description: "Resize images instantly",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "#7C3AED",
              colorBackground: "#13111C",
              colorText: "#E5E5E5",
              colorTextSecondary: "#9CA3AF",
              colorInputBackground: "#0B0B12",
              colorInputText: "#E5E5E5",
              colorNeutral: "#E5E5E5",
              colorDanger: "#EF4444",
              colorSuccess: "#22C55E",
              borderRadius: "0.5rem",
              fontFamily: "var(--font-geist-sans)",
            },
            elements: {
              card: "bg-surface border border-border shadow-2xl",
              headerTitle: "text-foreground",
              headerSubtitle: "text-foreground/55",
              socialButtonsBlockButton:
                "border-border bg-background/40 text-foreground hover:bg-surface",
              dividerLine: "bg-border",
              dividerText: "text-foreground/40",
              formFieldLabel: "text-foreground/70",
              formButtonPrimary:
                "bg-accent hover:bg-accent-light text-white normal-case",
              footerActionLink: "text-accent-light hover:text-accent",
              footer: "bg-surface",
            },
          }}
        >
          <PostHogProvider>
            <QuotaProvider>
              <Suspense fallback={null}>
                <PartnerRefCapture />
              </Suspense>
              <Header />
              {children}
            </QuotaProvider>
          </PostHogProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
