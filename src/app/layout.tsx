import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Аким на 5 часов — VIP POLO",
  description: "Пять решений, три района и один бюджет. Учебная модель управления условным городом."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
