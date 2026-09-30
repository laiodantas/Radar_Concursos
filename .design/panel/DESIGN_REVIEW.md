# Design Review: Painel do Radar de Concursos

> **Atualização (2026-09-30):** o painel foi redesenhado na direção **Swiss / International Typographic** — grid rígido, fios pretos como estrutura, alto contraste, Archivo Black + Archivo e tema claro por padrão com escuro opt-in (ver a seção "Interface" do README). A revisão abaixo registra a passada anterior, na direção Editorial / Magazine, e é mantida como histórico.

Reviewed against: sem `DESIGN_BRIEF.md` no projeto — revisão standalone contra a direção estética registrada no README ("Interface") e no `:root` de `src/app/globals.css`.
Philosophy: **Editorial / Magazine** — hierarquia por tipografia e fios, sem sombras; papel quente, serif de display (Playfair Display) e sans de texto (DM Sans).
Date: 2026-09-29

## Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `screenshots/review-painel-desktop-1280.png` | Desktop (1280) | Painel em demonstração, página inteira, tema claro (1280×2811). |
| `screenshots/review-painel-dark-mode-desktop-1280.png` | Desktop (1280) | O mesmo painel com `data-theme="dark"` ativo (1280×2811). |
| `screenshots/review-painel-tablet-768.png` | Tablet (768) | Reorganização em uma coluna, filtros e cartões empilhados (768×3430). |
| `screenshots/review-painel-mobile-375.png` | Mobile (375) | Base mobile-first, alvos de toque e respiro vertical (375×4480). |
| `screenshots/review-painel-dark-mode-mobile-375.png` | Mobile (375) | Base mobile em tema escuro (375×4480). |
| `screenshots/review-dados-reais-desktop-1280.png` | Desktop (1280) | `public/preview.html` com os 454 registros reais do MCP, tema claro (1280×900). |
| `screenshots/review-dados-reais-dark-mode-desktop-1280.png` | Desktop (1280) | O mesmo instantâneo em tema escuro (1280×900). |

> Todas as capturas estão em `.design/panel/screenshots/`. Foram geradas por CDP (`scripts/audit.ts`, Chrome headless) — não havia Playwright MCP nem navegador de IDE no ambiente.

## Summary

O painel entrega a direção editorial de forma convincente: a manchete em serif carrega a hierarquia, os fios substituem sombras e o papel quente mantém a leitura confortável de ponta a ponta, inclusive nas 454 linhas do instantâneo real. A revisão mediu o DOM em seis combinações (demonstração e dados reais × claro e escuro, em 1280 e 375) e **não encontrou nenhum problema em aberto**: alvos de toque, contraste efetivo, largura de linha e landmarks passam. O maior achado foi acessibilidade de contraste no tema claro (`--muted-2` a 4.27:1), que já foi corrigido e re-verificado antes deste relatório.

## Must Fix

Nenhum em aberto. Os itens desta severidade encontrados na primeira passada foram corrigidos e re-verificados (typecheck, lint, 24 testes e nova rodada do `scripts/audit.ts` "sem problemas medidos"):

1. **Contraste de texto abaixo de AA**: `--muted-2` era usado como cor de texto em rótulos e legendas e media 4.27:1 (claro) e 3.90:1. _Corrigido: rótulos de conteúdo passaram a usar `--muted`; `--muted-2` ficou restrita a fólios e ícones decorativos._
2. **Rótulos "01"–"04" ilegíveis**: numeravam a seção "De onde vêm esses números" em `--muted-2` a 10px. _Corrigido: cor para `--muted` e `aria-hidden="true"` nos numerais decorativos._
3. **Contraste em tema escuro**: `--on-forest-muted` media 4.22:1 sobre `--forest`. _Corrigido: clareado para `#cde6da`._
4. **Alvos de toque abaixo de 44px no mobile**: `.icon-button` media 44×44 mas encolhia para 36×44 em 375px; `.brand`, os `select` de filtro e os botões de limpar busca não atingiam 44px. _Corrigido: `flex: none` no botão de ícone, `min-height: 44px` na marca e 44px nos controles de filtro._

## Should Fix

1. **Revisão visual humana pendente**: a verificação foi por medição de DOM/CDP, não por leitura de pixels. Os screenshots existem e estão listados acima, mas vale um passe humano em `review-painel-desktop-1280.png` e `review-dados-reais-desktop-1280.png` para julgar ritmo, quebras de linha indesejadas e equilíbrio dos fios — coisas que a medição não captura.
2. **Navegadores além do Chromium**: tudo foi medido no Chrome headless. _Fix: conferir uma vez no Firefox e no Safari (a direção editorial depende de `next/font` self-hosted e de `color-scheme`; nenhum dos dois é exótico, mas convém registrar)._
3. **Interatividade fora do instantâneo**: `public/preview.html` é estático e os filtros/busca não respondem nele, então nenhum estado vivo (filtro ativo, busca sem resultado, aviso de consulta incompleta renderizado, `aria-pressed` do toggle de tema) foi capturado em imagem. _Fix: capturar ao menos o estado "busca sem resultado" e o aviso de consulta incompleta no painel servido por `npm run dev`._
4. **Caminho com PostgreSQL nunca exercitado**: o painel foi revisado contra o modo demonstração e o instantâneo do MCP, mas `npm run sync` real contra o banco não rodou (sem Docker/Postgres/`.env` no ambiente). _Fix: rodar o fluxo completo quando houver banco e revalidar o painel com dados persistidos, para confirmar que a seção "De onde vêm esses números" mostra a contagem da última execução corretamente._

## Could Improve

1. **Sinal de truncamento mais visível**: o aviso "Consulta possivelmente incompleta" (banner `warn-banner`) só aparece em uma condição que não ocorreu nas chamadas reais (454 recebidos = `meta.total`). _Sugestão: validar o tom visual desse banner com um dado forçado, já que ele nasce em condição rara._
2. **Transição do tema**: a troca claro/escuro é instantânea (só o chevron dos filtros tem `transition`). _Sugestão: uma transição curta de `background-color`/`color` (já neutralizada pelo bloco `prefers-reduced-motion`) suavizaria a troca sem custo perceptível._
3. **Afinar o rótulo de região**: `regionLabel` resume regiões vindas em caixa alta (`SUDESTE`); a normalização já cuida do caso comum, mas uma revisão da caixa de siglas (`UF`) ao lado do nome do órgão evitaria qualquer mistura de caixa alta no meio do texto corrido.
4. **Rodapé de cobertura**: a nota de cobertura e limites está bem escrita, mas fica longe do topo. _Sugestão: um link âncora curto a partir de "De onde vêm esses números" levaria o leitor curioso direto para os limites._

## What Works Well

- **Fidelidade à filosofia**: papel quente, serif de display e fios de 1px criam a sensação de impresso — nenhuma sombra, nenhum cartão genérico. A interface é reconhecível como editorial à primeira vista, inclusive em tema escuro, que reinterpreta a paleta em vez de invertê-la.
- **Hierarquia**: a manchete (`noticia.titulo`) domina, o órgão vem em seguida como crédito e os metadados viram uma grade de rótulos explícitos (Local / Cargos / Vagas). A ordem de leitura é inequívoca.
- **Prazo em linguagem clara**: "Faltam 3 dias", "Encerram hoje", "Encerradas há N dias", "Sem prazo na fonte" traduzem `datas.*` sem obrigar o leitor a interpretar datas — o melhor ganho de clareza do painel.
- **Transparência dos números**: a seção "De onde vêm esses números" explica origem e limites junto dos dados, em vez de esconder isso no README. É incomum e valioso num produto de dados de terceiros.
- **Tokens de verdade**: `globals.css` é totalmente tokenizado; os dois blocos de tema escuro são idênticos e `scripts/contrast.ts` detecta dessincronia. Nenhuma cor hardcoded escapou para os componentes.
- **Acessibilidade medida, não presumida**: `scripts/audit.ts` verifica overflow, alvos de toque, contraste computado no DOM, landmarks, rótulos de formulário e largura real de linha — e as 6 combinações terminam "sem problemas medidos". `prefers-reduced-motion` e `:focus-visible` estão presentes.
- **Mobile-first de fato**: a base é 375px e os breakpoints sobem com `min-width`; o layout reorganiza (filtros e cartões empilham) em vez de apenas encolher.
