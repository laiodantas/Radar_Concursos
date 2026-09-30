import { readFile } from "node:fs/promises";

/**
 * Confere o contraste WCAG dos pares de token usados nos componentes.
 * Lê `src/app/globals.css`, então qualquer ajuste na paleta é validado aqui.
 * O tema claro é o padrão (`:root`); o escuro é o bloco `[data-theme="dark"]`.
 */

const CSS = "src/app/globals.css";
const AA_TEXT = 4.5; // texto pequeno
const AA_LARGE = 3;  // texto grande (>=24px, ou >=18,66px em negrito) e componentes de UI

type Tokens = Record<string, string>;

function block(css: string, selector: string) {
  const at = css.indexOf(selector);
  if (at < 0) throw new Error(`Seletor não encontrado no CSS: ${selector}`);
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}
function tokens(blockText: string): Tokens {
  const found: Tokens = {};
  for (const match of blockText.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) found[match[1]] = match[2].trim();
  return found;
}
function toRgb(value: string) {
  const hex = value.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(full)) throw new Error(`Cor não suportada: ${value}`);
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
}
function luminance(value: string) {
  const channels = toRgb(value).map(c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function ratio(fg: string, bg: string) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/** [texto, fundo, o que é, limite] */
const pairs: Array<[string, string, string, number]> = [
  ["--ink", "--paper", "corpo e títulos", AA_TEXT],
  ["--ink", "--white", "campo de busca", AA_TEXT],
  ["--ink", "--paper-2", "código inline", AA_TEXT],
  ["--ink-2", "--paper", "texto secundário (13-15px)", AA_TEXT],
  ["--ink-2", "--paper-2", "rótulo e pill fechada", AA_TEXT],
  ["--ink-2", "--white", "select e pill de remuneração", AA_TEXT],
  ["--muted", "--paper", "legendas de 11-12px", AA_TEXT],
  ["--muted", "--paper-2", "nota de cobertura", AA_TEXT],
  ["--muted-2", "--paper", "fólio e numeração decorativos", AA_LARGE],
  ["--muted-2", "--paper-2", "ícone da lateral", AA_LARGE],
  ["--muted-2", "--white", "ícone do campo de busca", AA_LARGE],
  ["--accent", "--paper", "números, links e prazos", AA_TEXT],
  ["--accent", "--paper-2", "link do rodapé e da nota", AA_TEXT],
  ["--accent", "--white", "item ativo da lateral", AA_TEXT],
  ["--green", "--paper", "órgão, itálico do título, linha do eyebrow", AA_TEXT],
  ["--green", "--white", "ícone ativo da lateral", AA_LARGE],
  ["--on-forest", "--forest", "botão sólido e lateral no celular", AA_TEXT],
  ["--on-forest-soft", "--forest", "texto da lateral no celular", AA_TEXT],
  ["--on-forest-muted", "--forest", "links da lateral no celular", AA_TEXT],
  ["--chip-ink", "--chip-bg", "marca do radar", AA_TEXT],
  ["--green-ink", "--mint", "pill \"inscrições abertas\" e ícones", AA_TEXT],
  ["--amber", "--paper", "borda e filete de urgência", AA_LARGE],
  ["--amber-ink", "--amber-bg", "banner e selo de exemplo", AA_TEXT],
  ["--amber-ink", "--amber-badge", "selo de demonstração", AA_TEXT],
  ["--danger-ink", "--danger-bg", "banner de falha", AA_TEXT],
  ["--info-ink", "--info-bg", "ícone de dado atualizado", AA_LARGE]
];

function main() {
  return readFile(CSS, "utf8").then(css => {
    const light = tokens(block(css, ":root {"));
    const dark = tokens(block(css, '[data-theme="dark"]'));

    let failures = 0;
    for (const [name, theme] of [["CLARO (padrão)", light], ["ESCURO", dark]] as Array<[string, Tokens]>) {
      console.log(`\n=== tema ${name} ===`);
      for (const [fgKey, bgKey, what, min] of pairs) {
        const fg = theme[fgKey]; const bg = theme[bgKey];
        if (!fg || !bg) { console.log(`  ?  ${fgKey} sobre ${bgKey}: token ausente`); failures++; continue; }
        const value = ratio(fg, bg);
        const ok = value >= min;
        if (!ok) failures++;
        console.log(`  ${ok ? "ok " : "FALHA"} ${value.toFixed(2).padStart(5)}:1 (mín ${min})  ${fgKey} sobre ${bgKey} — ${what}`);
      }
    }
    console.log(failures ? `\n${failures} par(es) abaixo do limite.` : "\nTodos os pares passam no limite definido.");
    if (failures) process.exitCode = 1;
  });
}
main().catch(error => { console.error(`Verificação falhou: ${error instanceof Error ? error.message : "erro desconhecido"}`); process.exitCode = 1; });
