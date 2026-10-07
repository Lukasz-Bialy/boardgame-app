import { EB_Garamond } from "next/font/google";

// Szeryfowy krój do narracji i imion postaci — tylko w zakładce Przygoda (klasa .font-tale w globals.css)
const tale = EB_Garamond({
  subsets: ["latin", "latin-ext"],
  variable: "--font-tale",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export default function AdventureLayout({ children }: { children: React.ReactNode }) {
  return <div className={tale.variable}>{children}</div>;
}
