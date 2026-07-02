import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

const serif = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Musée — An Interactive Atlas of Art History",
  description:
    "A zoomable night-sky timeline of art history. Dive from glowing period nebulae into artist stars, then walk their paintings in a first-person 3D museum. All art and stories from Wikipedia & Wikimedia Commons.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="bg-[#050810] font-sans text-[#e8e3d5] antialiased">
        {children}
      </body>
    </html>
  );
}
