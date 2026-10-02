import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "./components/Toaster";
import { ImageUploadCompressor } from "./components/ImageUploadCompressor";

export const metadata: Metadata = {
  title: "Y.K Quality",
  description: "מערכת בקרת איכות לפרויקטי תשתית",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
        <ImageUploadCompressor />
      </body>
    </html>
  );
}
