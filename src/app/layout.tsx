import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaManager from "@/components/pwa/PwaManager";

export const metadata: Metadata = {
  title: "Kenzo — POS & Inventaris",
  description: "Sistem Point of Sale dan Manajemen Inventaris Toko Handphone Kenzo",
  keywords: "kasir, POS, inventaris, handphone, Kenzo",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kasir Kenzo",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1565c0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <PwaManager />
      </body>
    </html>
  );
}
