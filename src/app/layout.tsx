import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
// Paleta „Papier i sukno”. Usuń tę linię, żeby wrócić do poprzedniej (zielono-złotej) palety.
import "./theme-paper.css";

const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});
const sans = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Planszówki — klub",
  description: "Kolekcja gier, rozgrywki, ankiety i kalendarz spotkań",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: skrypt poniżej może dodać klasę "light" przed hydratacją
    <html lang="pl" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Ustawia zapisany motyw przed pierwszym malowaniem — bez mignięcia ciemnego motywu */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="light")document.documentElement.classList.add("light")}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
