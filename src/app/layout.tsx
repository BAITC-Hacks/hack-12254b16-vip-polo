import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Аким на 5 часов — VIP POLO",
  description: "Учебная модель управления условным городом. Нулевой этап разработки."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
