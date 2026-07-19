import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "./providers";
import LobbyMusic from "@/components/LobbyMusic";
import ToastHost from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Military Shooter 2D",
  description: "2D Military Shooter Game",
};

// Locks pinch-zoom/double-tap-zoom on mobile/tablet — without this, touch
// controls during gameplay (multi-finger taps for move+shoot) kept
// accidentally triggering the browser's native pinch-zoom gesture, breaking
// the Phaser Scale.FIT layout mid-match. viewport-fit=cover also pulls the
// canvas under the notch/home-indicator on iPhones/iPads instead of leaving
// letterboxed bars there.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-military-darker text-white min-h-screen font-military">
        <SessionProvider>
          <LobbyMusic />
          <ToastHost />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
