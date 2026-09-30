/**
 * Lógica de tema compartilhada entre o layout (script pré-pintura), o painel (toggle)
 * e os testes. Fonte única da verdade para a chave, o tema efetivo e a persistência.
 *
 * O painel abre no tema claro por padrão (a direção Swiss é de alto contraste sobre
 * branco). O tema escuro é opt-in: só passa a valer quando o usuário escolhe no botão
 * do header, e a escolha fica gravada neste navegador.
 */
export const THEME_KEY = "radar-tema-v1";
export type Theme = "light" | "dark";

/** Tema efetivo: a escolha gravada no navegador ou, sem escolha, o claro. */
export function effectiveTheme(stored: string | null | undefined): Theme {
  return stored === "dark" ? "dark" : "light";
}

/** Decisão do toggle: troca o tema efetivo; a nova escolha passa a valer neste navegador. */
export function toggleTheme(stored: string | null | undefined): Theme {
  return effectiveTheme(stored) === "dark" ? "light" : "dark";
}

/** Aplica o tema no `<html>` e grava (ou limpa) a escolha; silencioso quando o armazenamento falha. */
export function applyTheme(theme: Theme, persist?: string | null): void {
  document.documentElement.dataset.theme = theme;
  if (persist !== undefined) {
    try {
      if (persist === null) localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, persist);
    } catch { /* quota cheia ou modo privado: o tema vale só nesta visita */ }
  }
}

/**
 * Executa antes da primeira pintura para evitar flash de tema escuro em quem escolheu
 * escuro. Sem escolha gravada, fixa o claro. O layout injeta este script no `<html>`.
 */
export const themeBootScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t!=="dark"){t="light";}document.documentElement.dataset.theme=t;}catch(e){}})();`;
