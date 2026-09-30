import type { Metadata } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import "./globals.css";
import "./loading.css";

// Direção Swiss / International Typographic: uma família grotesca neutra em escala
// dramática. Archivo Black dá o peso de cartaz aos títulos e números; Archivo serve o texto.
const display = Archivo_Black({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const sans = Archivo({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

import { themeBootScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Radar de Concursos — concursos públicos com inscrições abertas",
  description: "Painel em português que reúne concursos públicos com inscrições abertas, prazos, vagas e remuneração informados pela PCI Concursos."
};

/** O script pré-pintura vem de `src/lib/theme.ts` junto com a lógica do toggle. */

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" suppressHydrationWarning className={`${display.variable} ${sans.variable}`}><body><script dangerouslySetInnerHTML={{ __html: themeBootScript }}/>{children}</body></html>;
}
