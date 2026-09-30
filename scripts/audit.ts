/* eslint-disable @typescript-eslint/no-explicit-any */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

/**
 * Auditoria de interface sem dependências: sobe o Chrome headless com CDP, mede o
 * DOM renderizado (overflow, alvos de toque, contraste efetivo, semântica) e salva
 * screenshots em .design/panel/screenshots. Requer o app rodando (npm run dev).
 */

const CHROME = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = Number(process.env.CDP_PORT ?? 9333);
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = ".design/panel/screenshots";

type WsLike = {
  send(data: string): void;
  close(): void;
  addEventListener(type: string, handler: (event: { data?: string }) => void): void;
};
const WebSocketCtor = (globalThis as { WebSocket?: new (url: string) => WsLike }).WebSocket;
if (!WebSocketCtor) throw new Error("Este script precisa do WebSocket global (Node 22+).");

type Shot = { url: string; name: string; width: number; height: number; scheme: "light" | "dark"; full: boolean };
const shots: Shot[] = [
  { url: "/", name: "review-painel-desktop-1280", width: 1280, height: 800, scheme: "light", full: true },
  { url: "/", name: "review-painel-tablet-768", width: 768, height: 1024, scheme: "light", full: true },
  { url: "/", name: "review-painel-mobile-375", width: 375, height: 812, scheme: "light", full: true },
  { url: "/", name: "review-painel-dark-mode-desktop-1280", width: 1280, height: 800, scheme: "dark", full: true },
  { url: "/", name: "review-painel-dark-mode-mobile-375", width: 375, height: 812, scheme: "dark", full: true },
  { url: "/preview.html", name: "review-dados-reais-desktop-1280", width: 1280, height: 900, scheme: "light", full: false },
  { url: "/preview.html", name: "review-dados-reais-dark-mode-desktop-1280", width: 1280, height: 900, scheme: "dark", full: false }
];
const audits = [
  { url: "/", name: "painel (demonstração)", width: 1280, height: 800 },
  { url: "/", name: "painel (demonstração)", width: 375, height: 812 },
  { url: "/preview.html", name: "dados reais (454 registros)", width: 1280, height: 900 }
];

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function targetUrl(): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const list = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`).then(response => response.json() as Promise<Array<{ type: string; webSocketDebuggerUrl: string }>>);
      const page = list.find(item => item.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* Chrome ainda subindo */ }
    await sleep(250);
  }
  throw new Error(`Não consegui falar com o CDP na porta ${CDP_PORT}.`);
}

function connect(url: string) {
  const Socket = WebSocketCtor;
  if (!Socket) throw new Error("WebSocket global indisponível.");
  const socket = new Socket(url);
  let sequence = 0;
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: unknown) => void }>();
  const events = new Map<string, Array<() => void>>();
  socket.addEventListener("message", event => {
    const message = JSON.parse(String(event.data)) as { id?: number; method?: string; result?: unknown; error?: { message?: string } };
    if (typeof message.id === "number") {
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message ?? "erro CDP"));
      else waiter.resolve(message.result);
    } else if (message.method) {
      (events.get(message.method) ?? []).forEach(handler => handler());
    }
  });
  const send = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const once = (method: string) => new Promise<void>(resolve => {
    const list = events.get(method) ?? [];
    list.push(() => resolve());
    events.set(method, list);
  });
  const opened = new Promise<void>(resolve => socket.addEventListener("open", () => resolve()));
  return { send, once, opened, close: () => socket.close() };
}

/** Roda dentro da página e devolve as medições. */
function collect(minTarget: number) {
  const parse = (color: string) => {
    const numbers = color.match(/[\d.]+/g)?.map(Number) ?? [];
    return { r: numbers[0] ?? 0, g: numbers[1] ?? 0, b: numbers[2] ?? 0, a: numbers[3] ?? 1 };
  };
  const luminance = (c: { r: number; g: number; b: number }) => {
    const channel = (value: number) => { const s = value / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
  };
  const ratio = (fg: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number }) => {
    const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  };
  const describe = (el: Element) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}`;

  const background = (el: Element) => {
    let node: Element | null = el;
    while (node) {
      const value = parse(getComputedStyle(node).backgroundColor);
      if (value.a > 0.5) return value;
      node = node.parentElement;
    }
    return parse(getComputedStyle(document.body).backgroundColor);
  };

  const root = document.documentElement;
  const viewport = { w: window.innerWidth, h: window.innerHeight };
  const wide: string[] = [];
  document.querySelectorAll("body *").forEach(el => {
    const box = el.getBoundingClientRect();
    if (box.width > viewport.w + 1 && box.right > viewport.w + 1) wide.push(`${describe(el)} (${Math.round(box.width)}px de largura)`);
  });

  // Links dentro de texto são excluídos: a regra de alvo mínimo vale para controles.
  const inlineLink = (el: Element) => Boolean(el.closest("p, .coverage-note, .footer, .heading-copy, .section-lead, .news-content, .preview-note"));
  const small: string[] = [];
  document.querySelectorAll("a, button, select, input, [role=button]").forEach(el => {
    if (inlineLink(el)) return;
    const style = getComputedStyle(el);
    if (el.tagName === "A" && style.display === "inline") return;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    if (box.width < minTarget || box.height < minTarget) small.push(`${describe(el)} ${Math.round(box.width)}×${Math.round(box.height)}`);
  });

  const seen = new Set<string>();
  const lowContrast: string[] = [];
  document.querySelectorAll("body *").forEach(el => {
    if (el.childElementCount > 0) return;
    if (el.getAttribute("aria-hidden") === "true") return;
    const text = (el.textContent ?? "").trim();
    if (!text) return;
    const style = getComputedStyle(el);
    const fontSize = parseFloat(style.fontSize);
    const bold = Number(style.fontWeight) >= 700;
    if (text.length < 2) return;
    const large = fontSize >= 24 || (bold && fontSize >= 18.66);
    const value = ratio(parse(style.color), background(el));
    if (value < (large ? 3 : 4.5)) {
      const key = `${describe(el)}|${value.toFixed(1)}`;
      if (seen.has(key)) return;
      seen.add(key);
      lowContrast.push(`${describe(el)} ${value.toFixed(2)}:1 · ${fontSize}px${bold ? " bold" : ""} · "${text.slice(0, 34)}"`);
    }
  });

  const headings: string[] = [];
  const headingCounts: Record<string, number> = {};
  document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(el => {
    if (el.getBoundingClientRect().width === 0) return;
    const tag = el.tagName.toLowerCase();
    headingCounts[tag] = (headingCounts[tag] ?? 0) + 1;
    if (headings.length < 4) headings.push(`${tag}: ${(el.textContent ?? "").trim().slice(0, 40)}`);
  });

  const inputs: string[] = [];
  document.querySelectorAll("input, select, textarea").forEach(el => {
    const id = el.getAttribute("id");
    const labelled = el.getAttribute("aria-label") || el.closest("label") || (id && document.querySelector(`label[for="${id}"]`));
    if (!labelled) inputs.push(describe(el));
  });

  const namelessButtons: string[] = [];
  document.querySelectorAll("button, a").forEach(el => {
    const name = (el.textContent ?? "").trim() || el.getAttribute("aria-label") || el.querySelector("svg title");
    if (!name) namelessButtons.push(describe(el));
  });

  // Largura média de caractere medida na própria fonte do elemento.
  const measure = (selector: string) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const style = getComputedStyle(el);
    const probe = document.createElement("span");
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${style.font}`;
    probe.textContent = "0".repeat(100);
    document.body.appendChild(probe);
    const charWidth = probe.getBoundingClientRect().width / 100;
    probe.remove();
    return { chars: Math.round(el.clientWidth / charWidth), fontSize: parseFloat(style.fontSize) };
  };

  return {
    viewport,
    scrollWidth: root.scrollWidth,
    overflowX: root.scrollWidth > viewport.w + 1,
    wide: wide.slice(0, 6),
    smallTargets: small.slice(0, 8),
    lowContrast: lowContrast.slice(0, 10),
    headings,
    headingCounts,
    landmarks: {
      main: Boolean(document.querySelector("main")),
      header: Boolean(document.querySelector("header")),
      nav: Boolean(document.querySelector("nav")),
      footer: Boolean(document.querySelector("footer"))
    },
    unlabelledInputs: inputs,
    namelessButtons: namelessButtons.slice(0, 5),
    lang: root.lang,
    bodyFontSize: getComputedStyle(document.body).fontSize,
    lineLength: { heading: measure(".heading-copy"), lead: measure(".section-lead") },
    darkScheme: window.matchMedia("(prefers-color-scheme: dark)").matches,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    bodyColor: getComputedStyle(document.body).color
  };
}

async function main() {
  if (!WebSocketCtor) throw new Error("WebSocket indisponível.");
  await mkdir(OUT_DIR, { recursive: true });
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", `--remote-debugging-port=${CDP_PORT}`, "--window-size=1280,900", "about:blank"], { stdio: "ignore" });
  const cdp = connect(await targetUrl());
  await cdp.opened;
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    console.log("== Medições ==");
    for (const scenario of audits) {
      for (const scheme of ["light", "dark"] as const) {
        await cdp.send("Emulation.setDeviceMetricsOverride", { width: scenario.width, height: scenario.height, deviceScaleFactor: 1, mobile: false });
        await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
        const loaded = cdp.once("Page.loadEventFired");
        await cdp.send("Page.navigate", { url: BASE + scenario.url });
        await loaded; await sleep(700);
        // O contexto é recriado a cada navegação: o shim do helper `__name` do esbuild
        // precisa ser reinstalado antes de rodar a função coletora.
        await cdp.send("Runtime.evaluate", { expression: "globalThis.__name = globalThis.__name || ((fn) => fn);" });
        // O tema padrão do painel é o claro: forçamos o `[data-theme]` aqui para medir os dois.
        await cdp.send("Runtime.evaluate", { expression: `document.documentElement.dataset.theme = ${JSON.stringify(scheme)};` });
        const minTarget = scenario.width <= 480 ? 44 : 24;
        const result = await cdp.send("Runtime.evaluate", { expression: `(${collect.toString()})(${minTarget})`, returnByValue: true });
        const data = result.result.value;
        if (!data) { console.log(`  (sem medições) ${result.exceptionDetails?.exception?.description ?? JSON.stringify(result).slice(0, 300)}`); continue; }
        const problems: string[] = [];
        if (data.overflowX) problems.push(`rolagem horizontal (scrollWidth ${data.scrollWidth} > ${data.viewport.w})`);
        if (data.wide.length) problems.push(`elementos mais largos que a tela: ${data.wide.join("; ")}`);
        if (data.smallTargets.length) problems.push(`alvos < ${minTarget}px: ${data.smallTargets.join("; ")}`);
        if (data.lowContrast.length) problems.push(`contraste abaixo de AA: ${data.lowContrast.join("; ")}`);
        if (data.unlabelledInputs.length) problems.push(`campos sem rótulo: ${data.unlabelledInputs.join(", ")}`);
        if (data.namelessButtons.length) problems.push(`botões/links sem nome acessível: ${data.namelessButtons.join(", ")}`);
        console.log(`\n[${scheme}] ${scenario.name} @${scenario.width}px`);
        console.log(`  fundo ${data.bodyBackground} · texto ${data.bodyColor} · esquema escuro ativo: ${data.darkScheme}`);
        console.log(`  landmarks: ${Object.entries(data.landmarks).map(([key, value]) => `${key}=${value ? "sim" : "não"}`).join(" ")} · lang=${data.lang} · corpo ${data.bodyFontSize}`);
        console.log(`  hierarquia: ${Object.entries(data.headingCounts).map(([tag, count]) => `${tag}×${count}`).join(" ")} · ${data.headings.join(" | ")}`);
        const line = [data.lineLength.heading, data.lineLength.lead].filter(Boolean).map(item => `${item!.chars} caracteres a ${item!.fontSize}px`).join(" · ");
        console.log(`  largura de linha: ${line}`);
        console.log(problems.length ? `  PROBLEMAS:\n    - ${problems.join("\n    - ")}` : "  sem problemas medidos");
      }
    }

    console.log("\n== Screenshots ==");
    for (const shot of shots) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: shot.width, height: shot.height, deviceScaleFactor: 1, mobile: shot.width <= 480 });
      await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: shot.scheme }] });
      const loaded = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url: BASE + shot.url });
      await loaded; await sleep(800);
      await cdp.send("Runtime.evaluate", { expression: `document.documentElement.dataset.theme = ${JSON.stringify(shot.scheme)};` });
      await sleep(250);
      // A listagem real passa de milhares de px e estoura o limite do CDP para captura
      // de página inteira ("Page is too large"); nesse caso cai para o viewport em vez de abortar.
      let image: { data: string };
      let mode = shot.full ? "página inteira" : "viewport";
      const capture = (beyond: boolean) => cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: beyond }) as Promise<{ data: string }>;
      try { image = await capture(shot.full); }
      catch (error) {
        if (!shot.full) throw error;
        image = await capture(false);
        mode = "viewport (alta demais para captura inteira)";
      }
      const path = `${OUT_DIR}/${shot.name}.png`;
      await writeFile(path, Buffer.from(image.data, "base64"));
      const size = (Buffer.from(image.data, "base64").length / 1024).toFixed(0);
      console.log(`  ${path} (${shot.width}×${shot.height}, ${mode}, ${size} KB)`);
    }
  } finally {
    cdp.close();
    chrome.kill();
  }
}
main().catch(error => { console.error(`Auditoria falhou: ${error instanceof Error ? error.message : "erro desconhecido"}`); process.exitCode = 1; });
