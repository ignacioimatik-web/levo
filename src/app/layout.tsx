import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileBottomNav from "@/components/MobileBottomNav";
import PwaRegistration from "@/components/PwaRegistration";
import ActivitySyncBridge from "@/components/activity/ActivitySyncBridge";
import ThemeProvider from "@/components/theme/ThemeProvider";
import { THEME_STORAGE_KEY } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://levo-eta.vercel.app"),
  manifest: "/manifest.webmanifest",
  title: {
    default: "E-nduro Ebiketracks | Rutas MTB & Enduro",
    template: "%s | E-nduro Ebiketracks"
  },
  description: "Descubre las mejores rutas autoguiadas por GPS de MTB, Enduro y All-Mountain en Morella y Els Ports. Aventuras épicas en la naturaleza.",
  keywords: ["Morella", "Singletracks", "MTB", "Enduro", "Els Ports", "Rutas GPS", "All-Mountain"],
  authors: [{ name: "E-nduro Ebiketracks" }],
  creator: "E-nduro Ebiketracks",
  icons: {
    icon: "/favicon.ico",
    apple: [
      {
        url: "/images/logo-enduro-ebiketracks.png",
        sizes: "1024x1024",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "https://levo-eta.vercel.app",
    siteName: "E-nduro Ebiketracks",
    title: "E-nduro Ebiketracks | Rutas MTB & Enduro",
    description: "Descubre las mejores rutas autoguiadas por GPS de MTB, Enduro y All-Mountain en Morella y Els Ports.",
    images: [
      {
        url: "https://images.unsplash.com/photo-1544198365-f5d60b6d8190?auto=format&fit=crop&q=80&w=1200",
        width: 1200,
        height: 630,
        alt: "E-nduro Ebiketracks MTB Adventure",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "E-nduro Ebiketracks | Rutas MTB & Enduro",
    description: "Descubre las mejores rutas autoguiadas por GPS de MTB, Enduro y All-Mountain en Morella y Els Ports.",
    images: ["https://images.unsplash.com/photo-1544198365-f5d60b6d8190?auto=format&fit=crop&q=80&w=1200"],
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=p==='light'||p==='dark'?p:(d?'dark':'light');document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){document.documentElement.dataset.theme='dark'}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-50">
        <ThemeProvider>
          <Navbar />
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
          <MobileBottomNav />
          <PwaRegistration />
          <ActivitySyncBridge />
        </ThemeProvider>
      </body>
    </html>
  );
}
