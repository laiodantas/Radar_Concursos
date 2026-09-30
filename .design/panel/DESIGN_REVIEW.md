# Revisão do Radar de Concursos

Data: 30/09/2026. Direção mantida: Swiss / International Typographic, Archivo, preto, branco e vermelho.

## Melhorias aplicadas por prioridade

1. **Busca e hierarquia:** cabeçalho compacto, busca e UF antes das estatísticas, atualização exibida uma vez, título explícito da lista. No celular de 375px a busca passou de aproximadamente 1.441px para 387px a partir do topo, redução de 73%.
2. **Comparação e volume:** paginação de 25 registros, cartões compactos, cargos resumidos e detalhes expansíveis com texto completo e links da fonte. O primeiro cartão mediu 268px de altura no desktop de 1280px.
3. **Dados confiáveis:** situação cruza status e datas; distingue inscrições futuras, vigentes, vencidas, suspensas e canceladas. Indicadores e alertas usam a mesma regra. Datas civis não recuam um dia por conversão de UTC. Remuneração preserva “até” e intervalos, inclusive nos dados já existentes.
4. **Filtros e navegação:** busca sem acentos com múltiplas palavras; filtros salvos automaticamente, chips removíveis, ação de limpar e estado vazio. Ordenação por prazo prioriza inscrições vigentes. Navegação acompanha a seção visível.
5. **Leitura e acesso:** campos de 16px, controles de 44px, texto secundário ampliado, foco visível, rótulos e anúncio de resultados, temas claro e escuro.
6. **Estrutura e sincronização:** componentes e regras separados. Sincronização aplica dados e eventos em transação, bloqueio entre processos, leitura em lote, createMany e updateMany. Uma falha reverte o lote. Nenhum registro ausente é apagado automaticamente.
7. **Revisão complementar:** corrigidos o leitor de tokens do tema escuro no script de contraste e a geração de prévia estática para mostrar todos os registros sem controles inativos de busca/paginação. Migrações via Neon HTTP agrupam SQL e registro em transação e conferem checksum. README atualizado.

## Verificações

| Verificação | Resultado |
| --- | --- |
| Testes automatizados | 38 testes aprovados |
| ESLint | Aprovado |
| TypeScript | Aprovado |
| Compilação de produção | Aprovada; avisos de compatibilidade do CSS corrigidos |
| Contraste dos tokens | Claro e escuro aprovados nos pares verificados |
| Layout no navegador integrado | 375, 768 e 1280px, sem rolagem horizontal |
| Campos de formulário | Fonte de 16px; altura mínima de 44px |
| Paginação com dados reais | 25 cartões; segunda página mostra 26–50 |
| Busca por medico/médico | Mesmo resultado: 134 registros |
| Persistência | Busca mantida após recarregar; chip removível limpa o filtro |
| Estado vazio | 0 resultados com orientação e ação para limpar |
| Inscrições futuras | 80 registros, cartões identificados corretamente |
| Prazo de até 7 dias | 130 registros; ordenação começa por inscrições que encerram hoje |
| Navegação | Seção Como ler marcada como atual ao chegar nela |
| PostgreSQL real | Transação e advisory lock confirmados por consultas; 454 registros, nenhuma escrita persistente |
| Sincronização em memória | Rollback após falha, lote de 454 registros sem mudanças, eventos e primeira carga cobertos por testes |

Na leitura de 30/09/2026, os 454 registros armazenados resultaram em 350 inscrições abertas com prazo vigente e 130 encerramentos em até sete dias. Esses números mudam com o dia e as consultas da fonte.

## Limites da revisão

- Não foram executadas sincronizações com escrita nem migrações no banco real. Rollback foi exercitado no armazenamento de teste; a transação e o lock foram conferidos no PostgreSQL sem alterar registros.
- A aplicação foi examinada no navegador integrado Chromium; Safari e Firefox não foram verificados.
- O contraste verificado cobre os pares definidos pelo script, sem alegação de certificação integral de acessibilidade.
- Não houve publicação, push ou mudança no agendamento remoto. Alterações locais na branch `codex/radar-design-review`.
- A fonte pode ter cobertura incompleta; cidade só aparece como filtro quando há registros com esse campo. O edital continua sendo a referência final.

Nenhuma falha bloqueadora foi encontrada nas verificações realizadas.