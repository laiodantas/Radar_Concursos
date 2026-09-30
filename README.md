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

A interface mantém a direção **Swiss / International Typographic**: Archivo Black nos títulos, Archivo no texto, grid, fios, preto, branco e vermelho. O cabeçalho compacto aproxima a busca do início da página. O CSS é mobile-first, com temas claro e escuro e fontes hospedadas pela aplicação.

- Busca por cargo, órgão e palavras-chave sem exigir acentos; filtro de UF em destaque, com região, situação e prazo em filtros adicionais.
- Preferências salvas automaticamente no navegador (`radar-filtros-v1`), com chips removíveis e mensagem de indisponibilidade quando o armazenamento falha. Tema separado em `radar-tema-v1`.
- Lista paginada em grupos de 25, ordenação por inclusão ou prazo, contagem de resultados e estado vazio com ação para limpar filtros.
- Situação atual combina as datas de Brasília com o status da fonte. Prazos vencidos, inscrições futuras, suspensões e cancelamentos ficam identificados. As estatísticas de inscrições abertas e encerramentos próximos usam a mesma regra dos cartões.
- Cartões compactos com local, vagas, remuneração e prazo. Qualificadores como “até” e intervalos de valores são preservados, inclusive para registros já armazenados. Cargos e informações completas ficam em detalhes expansíveis.
- Navegação indica a seção visível. Controles têm alvos de 44px, campos usam 16px, foco visível e rótulos acessíveis. As cores dos dois temas são verificadas por `npm run contrast`.
- `src/components/dashboard.tsx` organiza componentes separados para cartões, filtros, paginação, estatísticas e informações. Regras compartilhadas ficam em `src/lib/contest-state.ts` e `src/lib/contest-filters.ts`.
- Sem banco configurado, o painel usa quatro registros fictícios com aviso persistente de demonstração.
- `npm run preview:pci` consulta a fonte e gera `public/preview.html` com todos os registros, sem busca ou paginação interativas. Execute `npm run dev` ou `npm run build` antes para disponibilizar CSS e fontes.
- Verificações: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` e `npm run contrast`. A revisão visual e funcional desta versão foi feita no navegador integrado, em 375, 768 e 1280px.
- `.design/panel/DESIGN_REVIEW.md` registra as mudanças, evidências e limites da revisão de 2026-09-30. `scripts/audit.ts` continua disponível como utilitário independente de auditoria por CDP; não foi utilizado nesta revisão.
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

`titulo` é o órgão/entidade e a manchete descritiva fica em `noticia.titulo`; o radar usa a manchete como `title` e o órgão como `organization`. `vagas_salario` mistura vagas e remuneração em texto livre, então o coletor extrai o número de vagas (ou "Cadastro de reserva") e a remuneração, preservando qualificadores e intervalos de valores. As inscrições vêm apenas de `datas.inicio`/`datas.fim`, e `datas.aberto` + `datas.texto` ("Prorrogado", "Reaberto", "Cancelado") formam a situação exibida. Nenhuma ferramenta devolve cidade: `buscar_por_cidade` filtra por cidade, mas o registro não traz o campo, então o filtro "Cidade" do painel fica vazio quando só `listar_concursos` é consultada.

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

A consulta externa ocorre antes da transação. A aplicação dos registros, eventos e resultado bem-sucedido é atômica; uma falha reverte o lote. Um lock de transação no PostgreSQL serializa a aplicação entre processos. Registros existentes são consultados em lote, inclusões e eventos usam createMany e registros sem alteração usam updateMany. O registro de falha é gravado depois do rollback.

Não use uma plataforma que encerre processos longos de forma arbitrária sem um worker agendado. Erros ficam em `SyncRun`; o painel conserva e apresenta a data da última atualização bem-sucedida.

### Agendamento no GitHub Actions

O workflow `.github/workflows/sync-concursos.yml` executa `npm run sync` a cada três horas. O agendamento usa UTC e corresponde a 00:15, 03:15, 06:15, 09:15, 12:15, 15:15, 18:15 e 21:15 em Brasília. Há também execução manual em **Actions → Atualizar concursos a cada 3 horas → Run workflow**.

- O arquivo precisa estar na branch principal para que o agendamento funcione.
- Configure `DATABASE_URL` em **Settings → Secrets and variables → Actions** com a conexão do mesmo banco usado pelo site. Não grave essa conexão em arquivos versionados. `DIRECT_URL` recebe o mesmo secret apenas para geração do cliente; nenhuma migração é executada.
- `RADAR_SOURCE=pci` e o endpoint público da PCI ficam definidos no workflow. Para consultas próprias, configure o secret opcional `PCI_QUERIES_JSON`.
- A tarefa executa em Linux, tem permissão de leitura do repositório, limite de dez minutos e evita duas execuções simultâneas. Não depende do computador local nem da hospedagem do site.
- Confira os resultados em Actions e a última atualização bem-sucedida no painel. O GitHub pode atrasar os horários e desativa agendamentos de repositórios públicos após 60 dias sem atividade.
- Runners padrão de repositórios públicos são gratuitos. Banco, hospedagem e fonte têm limites próprios; o workflow não altera planos pagos.

### Coleta de editais

Após cada sincronização, o workflow executa `npm run collect:notices`. O coletor lê as notícias públicas da PCI, identifica os anexos rotulados como edital e preenche `noticeUrl`.

Quando existe um PDF público, o botão aponta para ele. Quando a PCI libera o PDF apenas após CAPTCHA, o botão aponta para `#captcha-editais` da notícia correspondente. O painel explica essa etapa: o usuário conclui a verificação na própria PCI. O coletor não tenta resolver nem contornar CAPTCHA, não inventa URLs de documentos e ignora links de notícias relacionadas, resultados e retificações isoladas.

As consultas têm limite de dez segundos, quatro trabalhadores, pausa de 250ms e orçamento de cinco minutos por execução. Páginas conferidas são reutilizadas por 24 horas; falhas temporárias voltam a ser tentadas após três horas. Uma falha conserva links já encontrados. Metadados de coleta ficam em `raw._radarNotice`, sem alterar o JSON original dos campos da fonte. A sincronização MCP preserva os editais coletados quando a resposta não fornece esse campo.

Nem toda página da fonte publica um edital. Nesses casos, o botão não aparece até ser encontrado um anexo correspondente. Nenhuma migração de banco é necessária.

## Banco, testes e publicação

- Migração local: `npm run db:migrate`
- Aplicar migrações em produção: `npm run db:deploy`
- Sincronizar: `npm run sync`
- Verificações: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run contrast` e `npm run audit` (`audit` exige o painel de pé; `contrast` só lê o CSS)
- Desenvolver: `npm run dev`; publicar: `npm run build` e `npm start` em runtime Node, com PostgreSQL persistente.

Use um serviço PostgreSQL gerenciado, configure as variáveis de ambiente, execute `npm run db:deploy` antes de iniciar a aplicação e configure o cron/worker acima. A publicação redistribui campos retornados pela PCI; consulte as condições de uso e obtenha autorização aplicável antes de oferecer redistribuição comercial.

## Publicação na Vercel e deploy automático

O projeto Vercel `laio/radar-concursos` está conectado ao repositório `laiodantas/Radar_Concursos`. A branch de produção é `main`: cada push nela gera uma nova compilação e, quando bem-sucedida, atualiza o endereço de produção. Outras branches geram prévias pela integração Git.

- `vercel.json` define Next.js, instalação com `npm ci` e compilação com `npm run build`, que também gera o cliente Prisma.
- Configure `DATABASE_URL` e `DIRECT_URL` como secrets de **Production** na Vercel, com o banco usado pela sincronização. Configure `RADAR_SOURCE=pci` para exibir os registros reais.
- As prévias sem banco configurado exibem dados fictícios, sinalizados como demonstração. Não é necessário compartilhar credenciais de produção com branches de prévia.
- Arquivos `.env`, `.env.local` e `.vercel` permanecem fora do Git. A configuração local da CLI contém apenas o vínculo do projeto.
- O GitHub Actions atualiza o banco a cada três horas; o deploy automático atualiza o código do site quando há push. A página lê o banco em cada acesso, sem precisar de novo deploy para refletir a sincronização.
- Confira deploys e logs no painel da Vercel. Se uma compilação falhar, o endereço de produção conserva a última versão publicada com sucesso.

## Cobertura e limites

O MCP é beta público e a PCI declara que a coleção pode ser incompleta. O radar só pode refletir as ferramentas e filtros efetivamente consultados. A listagem de 2026-09-29 veio em um lote único (454 registros, igual a `meta.total`) e o `inputSchema` não expõe paginação, mas isso não garante que o acervo cubra todos os editais: não prometa cobertura nacional. Para ampliar a cobertura, configure consultas direcionadas por cargos, UFs e regiões em `PCI_QUERIES_JSON` e compare os resultados antes de alegar abrangência. Como nenhuma ferramenta devolve cidade, o filtro "Cidade" do painel não tem dados quando só `listar_concursos` é consultada.

Os filtros preferidos são armazenados em `localStorage` sem conta. `src/lib/notifications.ts` define a interface de canais futuros; no MVP só eventos do site são persistidos e exibidos, sem envio por WhatsApp.
