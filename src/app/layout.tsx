import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "E-nduro Singletracks | Rutas MTB & Enduro",
    template: "%s | E-nduro Singletracks"
  },
  description: "Descubre las mejores rutas autoguiadas por GPS de MTB, Enduro y All-Mountain en Morella y Els Ports. Aventuras épicas en la naturaleza.",
  keywords: ["Morella", "Singletracks", "MTB", "Enduro", "Els Ports", "Rutas GPS", "All-Mountain"],
  authors: [{ name: "E-nduro Singletracks" }],
  creator: "E-nduro Singletracks",
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "https://ignacioimatik-web.github.io/levo",
    siteName: "E-nduro Singletracks",
    title: "E-nduro Singletracks | Rutas MTB & Enduro",
    description: "Descubre las mejores rutas autoguiadas por GPS de MTB, Enduro y All-Mountain en Morella y Els Ports.",
    images: [
      {
        url: "https://images.unsplash.com/photo-1544198365-f5d60b6d8190?auto=format&fit=crop&q=80&w=1200",
        width: 1200,
        height: 630,
        alt: "E-nduro Singletracks MTB Adventure",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "E-nduro Singletracks | Rutas MTB & Enduro",
    description: "Descubre las mejores rutas autoguiadas por GPS de MTB, Enduro y All-Mountain en Morella y Els Ports.",
    images: ["https://images.unsplash.com/photo-1544198365-f5d60b6d8190?auto=format&fit=crop&q=80&w=1200"],
  },
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
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-50">
        <Navbar />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}

