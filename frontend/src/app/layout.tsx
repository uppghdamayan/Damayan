import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { Toaster } from "@/components/ui/sonner";
import { UiScaleEffect } from "@/components/providers/UiScaleEffect";
import { AppWidthEffect } from "@/components/providers/AppWidthEffect";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: "DAMAYAN EMR",
  description: "Problem-Oriented Dynamic Clinical Note Interface",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("h-full antialiased", ibmPlexSans.variable, ibmPlexMono.variable)}>
      {/*
        The layout container stays on <body>, exactly where it has always been.
        Naming it `app` is the only change: it lets the layout components query
        this specific container by name (@max-laptop/app:) instead of relying on
        "nearest ancestor container", which is what let ScreenNav silently
        measure the window when it meant to measure its own column.
      */}
      <body className="@container/app min-h-full flex flex-col font-sans">
        <QueryProvider>
          <UiScaleEffect />
          <AppWidthEffect />
          {children}
        </QueryProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
