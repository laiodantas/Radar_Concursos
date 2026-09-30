import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTheme, THEME_KEY, effectiveTheme, themeBootScript, toggleTheme } from "../src/lib/theme";

describe("tema: padrão claro e alternância para escuro", () => {
  it("a escolha gravada vence o padrão", () => {
    assert.equal(effectiveTheme("light"), "light");
    assert.equal(effectiveTheme("dark"), "dark");
  });
  it("sem escolha válida, abre no claro (o escuro é opt-in)", () => {
    assert.equal(effectiveTheme(null), "light");
    assert.equal(effectiveTheme(undefined), "light");
    assert.equal(effectiveTheme("auto"), "light");
    assert.equal(effectiveTheme(""), "light");
    assert.equal(effectiveTheme("DARK"), "light");
  });
  it("o toggle troca o tema efetivo e leva ao escuro quando não há escolha", () => {
    assert.equal(toggleTheme(null), "dark");
    assert.equal(toggleTheme("light"), "dark");
    assert.equal(toggleTheme("dark"), "light");
  });
  it("applyTheme aplica o atributo no <html> e persiste a escolha", () => {
    type FakeDoc = { documentElement: { dataset: Record<string, string> } };
    type FakeStorage = { setItem(k: string, v: string): void; removeItem(k: string): void; getItem(k: string): string | null };
    const doc: FakeDoc = { documentElement: { dataset: {} } };
    const values = new Map<string, string>();
    const g = globalThis as unknown as { document?: FakeDoc; localStorage?: FakeStorage };
    g.document = doc;
    g.localStorage = {
      setItem: (k, v) => { values.set(k, v); },
      removeItem: (k) => { values.delete(k); },
      getItem: (k) => values.get(k) ?? null
    };
    applyTheme("dark", "dark");
    assert.equal(doc.documentElement.dataset.theme, "dark", "o tema precisa chegar ao <html> na hora");
    assert.equal(values.get(THEME_KEY), "dark");
    applyTheme("light", null);
    assert.equal(doc.documentElement.dataset.theme, "light");
    assert.equal(values.has(THEME_KEY), false, "persistir null precisa limpar a escolha");
    g.document = undefined;
    g.localStorage = undefined;
  });
  it("o script pré-pintura usa a mesma chave e fixa o claro por padrão", () => {
    assert.ok(themeBootScript.includes(JSON.stringify(THEME_KEY)), "o script precisa ler a mesma chave do painel");
    assert.ok(themeBootScript.includes('t="light"'), "sem escolha gravada, o script fixa o tema claro");
    assert.ok(themeBootScript.includes("dataset.theme"), "o script precisa aplicar o tema antes da pintura");
    assert.ok(themeBootScript.trim().startsWith("(function"), "precisa ser um IIFE executável inline");
  });
});
