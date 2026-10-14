import type { Metadata, Viewport } from "next";
import { Archivo, Bowlby_One, IBM_Plex_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { INTRO_BOOT_SCRIPT, IntroSplash } from "@/components/intro/intro-splash";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bowlby = Bowlby_One({
  variable: "--font-bowlby",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: { default: "StreetPlay", template: "%s · StreetPlay" },
  description: "Run the game. Pay on camera. Question packs, prize wheels and bank payouts with the winner's verified name on screen.",
  applicationName: "StreetPlay",
  appleWebApp: { capable: true, title: "StreetPlay", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#131211",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable} ${bowlby.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Decides before first paint whether the first-launch intro plays. */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <IntroSplash />
        <OfflineBanner />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
