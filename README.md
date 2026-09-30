# Radar de Concursos

Painel web em português para armazenar e acompanhar registros retornados pelo MCP oficial da PCI Concursos. O site lê o PostgreSQL; cada visitante não consulta o MCP. A integração MCP foi validada contra o endpoint real em 2026-09-29 (veja "Inspeção validada" abaixo). O padrão `RADAR_SOURCE=demo` usa apenas registros sintéticos, com faixa de demonstração persistente no site.

## Requisitos locais

- Node.js 22 ou mais recente (o app roda em 20.9, mas `npm run audit` usa o `WebSocket` global do Node 22)
- PostgreSQL (Neon gerenciado, Docker Desktop ou instalação local)
- npm

> **Rede bloqueando a porta 5432?** O app detecta URLs do Neon e conversa com o banco por WebSocket/HTTPS na 443 via `@prisma/adapter-neon` (veja `src/lib/db.ts`). Migrações: se o `prisma migrate deploy` falhar com `P1001`, use `npx tsx scripts/apply-migrations.ts`, que aplica os mesmos arquivos SQL registrando-os em `_prisma_migrations` pelo mesmo caminho HTTPS.

## Iniciar localmente

```powershell
Copy-Item .env.example .env
docker compose up -d db
npm install
npm run db:generate
npm run db:migrate
npm run demo:seed
npm run dev
```

Abra http://localhost:3000. Os quatro concursos de exemplo têm instituições fictícias e não representam oportunidades atuais. Para limpar o banco de demonstração: `docker compose down -v` (apaga todo o volume local).

## Interface

A interface segue a direção **Swiss / International Typographic**: objetividade pela estrutura. Grid rígido, fios de 1px como elementos estruturais (não sombras), alto contraste, tipografia grotesca em escala dramática e cor plana — preto, branco e um único primário vermelho, usado editorialmente. Sem sombras, gradientes ou cantos arredondados. Os títulos e números usam **Archivo Black**; o texto usa **Archivo**; as duas vêm de `next/font`, então ficam self-hosted e não bloqueiam a renderização.

- Cores, tipografia e ritmo ficam em `:root` de `src/app/globals.css`. O CSS é mobile-first: a base é o celular e os breakpoints sobem com `min-width` (640, 900, 1200).
- O painel abre no **tema claro** por padrão. O tema escuro é opt-in pelo botão do cabeçalho, que grava a escolha em `localStorage` (`radar-tema-v1`) e a aplica como `data-theme` no `<html>`. O escuro reinterpreta os mesmos tokens no bloco `[data-theme="dark"]` em vez de inverter a paleta. A lógica do tema (chave, tema efetivo e o script pré-pintura que evita flash de tema escuro) fica em `src/lib/theme.ts`, com testes de regressão em `tests/theme.test.ts`.
- `src/components/dashboard.tsx` contém o painel inteiro — cartões com rótulos explícitos (Local, Cargos, Vagas), prazo traduzido em dias ("Faltam 3 dias") e a seção **Como ler**, que explica a origem dos números e os limites de cobertura.
- Sem banco, `src/app/page.tsx` cai no modo demonstração e renderiza o painel com quatro registros fictícios: é o jeito mais rápido de ver a interface (`npm run dev`).
- `tests/dashboard.test.ts` renderiza o painel com `react-dom/server` e verifica o filtro de cidade, o aviso de consulta incompleta e os textos de prazo.
- `npm run preview:pci` consulta o MCP e escreve um instantâneo estático do painel em `public/preview.html` (ignorado pelo git), já com o CSS e as fontes da build atual. Serve para revisar o visual com dados reais sem PostgreSQL — os filtros e a busca não funcionam no instantâneo. Rode `npm run dev` ou `npm run build` antes, para existir `.next/static/css`.
- `npm run contrast` lê `src/app/globals.css`, percorre os pares de tokens em claro e escuro e falha se algum não atingir WCAG AA (4.5:1 para texto, 3:1 para texto grande), além de acusar dessincronia entre os dois blocos de tema escuro. Rode depois de mexer em cor.
- `npm run audit` abre o painel no Chrome headless por CDP e mede, em claro e escuro e nos breakpoints de 1280 e 375: rolagem horizontal, alvos de toque (44px no mobile), contraste efetivo computado no DOM, ordem de títulos e landmarks, rótulos de formulário, nomes de botões e largura real de linha. Salva capturas em `.design/panel/screenshots/`. O servidor precisa estar de pé (`npm run dev`).
- `.design/panel/DESIGN_REVIEW.md` registra a revisão de design: capturas, o que foi corrigido e o que ainda depende de banco ou de leitura visual humana.

## PCI MCP

A página oficial anuncia `buscar_por_cargo`, `buscar_por_cidade`, `listar_concursos`, `pesquisar_concursos` e `buscar_apostilas`. Ela diz que as ferramentas de concursos filtram inscrições abertas, descreve os filtros gerais e alerta que o acervo pode não cobrir todos os editais. Apostilas não entram no produto.

O cliente MCP usa JSON-RPC via HTTP Streamable, `tools/list`, tempo limite, tentativas curtas e `tools/call`. Ele tenta as versões de handshake de `2025-11-25` até `2024-11-05` quando o servidor indica incompatibilidade e segue a versão negociada. A chamada padrão seleciona `listar_concursos` sem argumentos somente se o servidor anunciar a ferramenta sem parâmetros obrigatórios. Consultas próprias podem ser configuradas no servidor por `PCI_QUERIES_JSON`, por exemplo (os nomes dos argumentos devem vir do `inputSchema` real):

```json
[{"tool":"pesquisar_concursos","arguments":{"termo":"analista","uf":"sp"}}]
```

### Inspeção validada em 2026-09-29

O endpoint respondeu ao handshake, negociou `2025-06-18`, aceitou requisições sem `mcp-session-id` (modo stateless) e anunciou 5 ferramentas:

| Ferramenta | Obrigatórios | Opcionais |
| --- | --- | --- |
| `listar_concursos` | nenhum | `regiao` (`norte`, `nordeste`, `centro-oeste`, `sudeste`, `sul`) e `professores` (booleano) |
| `pesquisar_concursos` | `termo` | `uf` |
| `buscar_por_cargo` | `cargo` | `uf` |
| `buscar_por_cidade` | `uf`, `cidade` | — |
| `buscar_apostilas` | `termo` | — |

Como `listar_concursos` aceita chamada vazia, a chamada padrão continua sendo usada. Ela devolveu 454 registros em um único lote, com `meta.total = 454` e `meta.filtros = {"regiao":"","professores":false}` (sem filtro). O `inputSchema` não expõe nenhum parâmetro de paginação, então a resposta parece completa em uma única chamada; a sincronização registra um aviso em `notes` quando `meta.total` difere da quantidade recebida, guarda o total anunciado em `SyncRun.expectedCount` e o painel exibe "Consulta possivelmente incompleta" quando a última execução bem-sucedida recebeu menos registros do que a fonte anunciou.

Cada registro tem esta forma (os prazos ficam aninhados em `datas` e a origem em `noticia`):

```json
{ "id": 294509, "titulo": "AgSUS - Agência Brasileira de Apoio à Gestão do SUS",
  "cargos_resumo": "Psicólogo", "cargos": ["PSICÓLOGO"], "vagas_salario": "15 vagas até R$ 7.181,50",
  "formacao": "Superior", "regiao": "SUDESTE", "uf": "SP",
  "datas": { "inicio": "2026-09-16", "fim": "2026-10-16", "texto": "", "aberto": true, "dias_restantes": 17 },
  "noticia": { "id": 294509, "titulo": "AgSUS retifica processo seletivo para psicólogos",
               "link": "https://www.pciconcursos.com.br/noticias/...", "imagem": "https://cdn.pci.app.br/img/..." },
  "apostila": null }
```

`titulo` é o órgão/entidade e a manchete descritiva fica em `noticia.titulo`; o radar usa a manchete como `title` e o órgão como `organization`. `vagas_salario` mistura vagas e remuneração em texto livre, então o coletor extrai o número de vagas (ou "Cadastro de reserva") e o valor em reais. As inscrições vêm apenas de `datas.inicio`/`datas.fim`, e `datas.aberto` + `datas.texto` ("Prorrogado", "Reaberto", "Cancelado") formam a situação exibida. Nenhuma ferramenta devolve cidade: `buscar_por_cidade` filtra por cidade, mas o registro não traz o campo, então o filtro "Cidade" do painel fica vazio quando só `listar_concursos` é consultada.

A tabela de aliases em `src/lib/normalize.ts` está ajustada a esse formato. O `contentHash` é calculado a partir dos campos normalizados de `trackedContestFields`, o que é o que permite detectar mudanças aninhadas como `datas.fim`.

O probe faz o mesmo handshake do coletor e imprime as respostas sem gravar no banco (não importa `src/lib/db`):

```powershell
npm run probe:pci                                              # versão negociada e schemas resumidos
npm run probe:pci -- --schema-out tools.json                   # tools/list completo em JSON
npm run probe:pci -- --call                                    # usa PCI_QUERIES_JSON
npm run probe:pci -- --tool pesquisar_concursos --args '{"termo":"analista","uf":"sp"}'
npm run probe:pci -- --all-queries --out probe.json            # uma chamada por ferramenta (pula apostilas)
npm run probe:pci -- --dry-run-sync                            # coletor + sincronização em memória, sem banco
```

`--dry-run-sync` roda `fetchPci` e `synchronize` completos contra um armazenamento em memória e imprime contagem, `meta.total`, eventos gerados e uma amostra normalizada. É a forma mais rápida de conferir o MCP de ponta a ponta sem PostgreSQL — e serve como fumaça antes de ligar `RADAR_SOURCE=pci`, porque não importa `src/lib/db`.

Defina `PCI_DEBUG=1` para imprimir método, status HTTP e content-type de cada requisição.

Para ativar com os dados validados:

1. Defina `RADAR_SOURCE=pci` no ambiente de servidor; a consulta padrão sem argumentos já cobre a listagem completa.
2. Rode `npm run sync` uma vez e confira contagem, execução e registros no painel antes de criar o agendamento.

Ainda não validado: respostas de erro das ferramentas, limites de requisição/concorrência do endpoint e se a listagem cobre todos os editais — a própria PCI avisa que o acervo pode ser incompleto. `buscar_apostilas` não é chamada.

O coletor mantém o JSON original. A tabela de aliases de normalização segue os campos reais observados (veja acima) e mantém nomes alternativos em português/inglês como reserva; formatos não reconhecidos falham sem gravar. A chave usa o `id` da fonte, depois o link e, como último recurso, título e órgão. Se uma chamada retorna erro, vazio ou formato não reconhecido, ela falha antes de aplicar os dados. Registros ausentes em consultas posteriores nunca são apagados nem encerrados automaticamente. A primeira execução bem-sucedida cria a base sem eventos de novidade. Mudanças acompanham título, órgão, cargo, local, vagas, remuneração, prazos, situação e links somente quando reconhecidos. Datas sem hora são interpretadas ao meio-dia de `America/Sao_Paulo`; exibição e contagem de dias usam o mesmo fuso.

## Sincronização manual e agenda

- Local/manual: `npm run sync`
- Serviço remoto: `POST /api/admin/sync` com `Authorization: Bearer $SYNC_SECRET`. Sem segredo ou token inválido retorna 401. Nunca exponha esse segredo no navegador.
- Produção: execute `npm run sync` em um worker/cron a cada 3 horas (por exemplo, minuto 15: `15 */3 * * *`). Configure `DATABASE_URL`, `RADAR_SOURCE`, `PCI_MCP_URL`, `PCI_QUERIES_JSON`, `SYNC_TIMEOUT_MS`, `SYNC_MAX_RETRIES` e `SYNC_SECRET` no ambiente secreto do provedor.

Não use uma plataforma que encerre processos longos de forma arbitrária sem um worker agendado. Erros ficam em `SyncRun`; o painel conserva e apresenta a data da última atualização bem-sucedida.

## Banco, testes e publicação

- Migração local: `npm run db:migrate`
- Aplicar migrações em produção: `npm run db:deploy`
- Sincronizar: `npm run sync`
- Verificações: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run contrast` e `npm run audit` (os dois últimos exigem o painel de pé; `contrast` só lê o CSS)
- Desenvolver: `npm run dev`; publicar: `npm run build` e `npm start` em runtime Node, com PostgreSQL persistente.

Use um serviço PostgreSQL gerenciado, configure as variáveis de ambiente, execute `npm run db:deploy` antes de iniciar a aplicação e configure o cron/worker acima. A publicação redistribui campos retornados pela PCI; consulte as condições de uso e obtenha autorização aplicável antes de oferecer redistribuição comercial.

## Cobertura e limites

O MCP é beta público e a PCI declara que a coleção pode ser incompleta. O radar só pode refletir as ferramentas e filtros efetivamente consultados. A listagem de 2026-09-29 veio em um lote único (454 registros, igual a `meta.total`) e o `inputSchema` não expõe paginação, mas isso não garante que o acervo cubra todos os editais: não prometa cobertura nacional. Para ampliar a cobertura, configure consultas direcionadas por cargos, UFs e regiões em `PCI_QUERIES_JSON` e compare os resultados antes de alegar abrangência. Como nenhuma ferramenta devolve cidade, o filtro "Cidade" do painel não tem dados quando só `listar_concursos` é consultada.

Os filtros preferidos são armazenados em `localStorage` sem conta. `src/lib/notifications.ts` define a interface de canais futuros; no MVP só eventos do site são persistidos e exibidos, sem envio por WhatsApp.
