# Plano de implementação — Itens por empresa

Spec: `docs/superpowers/specs/2026-10-30-itens-por-empresa-design.md`
App: `refeicoes/` (todos os caminhos abaixo são relativos a ele)

## Como verificar

- **Tipos/build:** `npm run build` (roda `tsc -b`) e `npm run lint`.
- **Testes:** são scripts de navegador contra o emulador. Subir `npx firebase emulators:start`, rodar `npm run dev` com `VITE_RODAR_TESTES=true`, ativar **só a fase da vez** em `src/main.tsx` e ler o console (✅/❌). Os testes fazem login/logout; não rodar duas fases juntas.
- Entre as fases 1 e 4 o build fica quebrado (os tipos mudam antes das telas). Isso é esperado; o build volta a passar no fim da fase 4. Cada fase vira um commit.

## Fase 0 — Limpeza

1. Branch `feat/itens-por-empresa` a partir de `main`.
2. Remover `src/firestore.rules` (cópia antiga, só bloqueia tudo; o `firebase.json` usa `firestore.rules`).
3. Emulador: apagar os dados exportados de teste (`firebase-export-*/`) ou rodar sem `--import`, para começar limpo. Confirmar com a usuária antes de apagar a pasta de export.

## Fase 1 — Tipos e utilitários

1. `src/types.ts`
   - Remover `Refeicao`, `REFEICOES`, `PorRefeicao`.
   - Adicionar:
     ```ts
     export type Item = { id: string; nome: string; precoCentavos: number; ativo: boolean };
     export type ItemDoDia = { nome: string; quantidade: number; precoCentavos: number };
     export type ItensDoDia = Record<string, ItemDoDia>; // chave = itemId
     ```
   - `Empresa = { id, nome, ativa }`.
   - `Lancamento = { data, itens: ItensDoDia, totalCentavos, qtdFotos? }`.
   - `calcularTotal(itens: ItensDoDia): number` = Σ quantidade × precoCentavos.
2. `src/lib/refeicoes.ts` → `src/lib/itens.ts`
   - Manter `parseQuantidade` e `centavosParaTexto`.
   - Remover `NOMES_REFEICOES`, `TextoPorRefeicao`, `textoVazio`, `precosParaTexto`, `converterCampos/Precos/Quantidades`.
   - Adicionar `normalizar(texto)` (minúsculas, sem acento via `normalize('NFD')`, `trim`, espaços colapsados), `ordenarPorNome(lista)` (`localeCompare` pt-BR) e `contarItens(itens: ItensDoDia)` (soma das quantidades).
   - Adicionar `montarItensDoDia(quantidades: Record<string, number>, catalogo: Item[], atual: ItensDoDia | null): ItensDoDia`:
     - descarta quantidade 0;
     - item já em `atual` → mantém `nome` e `precoCentavos` gravados, troca só a quantidade;
     - item novo → `nome` e `precoCentavos` do catálogo; se o id não existe no catálogo nem em `atual`, lança `'Item desconhecido.'`.
3. Remover `src/componentes/CamposPrecos.tsx`.

## Fase 2 — Regras e services

1. `firestore.rules`
   - Remover `porRefeicaoValido`.
   - `empresaValida`: só `nome` (string 1–100) e `ativa` (bool).
   - Novo `itemValido`: só `nome` (string 1–100), `precoCentavos` (int ≥ 0), `ativo` (bool), todos obrigatórios.
   - `lancamentoValido`: `hasAll(['itens','totalCentavos'])`, `hasOnly(['itens','totalCentavos','qtdFotos'])`, `itens is map`, `itens.size() > 0`, `totalCentavos is int && >= 0`, `qtdFotos` opcional int ≥ 0. Comentário explicando que a soma é conferida no service (regras não têm laço).
     - Atenção: o `setDoc(..., { qtdFotos }, { merge: true })` de `fotos.ts` valida o documento resultante, que já tem `itens`; confirmar no teste de regras.
   - Novo bloco:
     ```
     match /itens/{itemId} {
       allow read: if autorizado();
       allow create, update: if autorizado() && itemValido(request.resource.data);
       allow delete: if false;
     }
     ```
     (fora de `match /empresas/...`; o `match /{document=**}` de negação continua dentro de empresas como hoje.)
2. `src/services/itens.ts` (novo)
   - `listarItens(): Promise<Item[]>` (ordenado por nome).
   - `criarItem({ nome, precoCentavos }): Promise<string>` — `trim`, valida nome 1–100 e preço inteiro ≥ 0, recusa nome duplicado entre ativos (`normalizar`) com `'Já existe um item ativo com esse nome.'`; grava `ativo: true`.
   - `atualizarItem(id, { nome, precoCentavos })` — mesmas validações, ignorando o próprio id na duplicidade.
   - `definirAtivo(id, ativo)` — ao reativar, checa duplicidade de nome.
3. `src/services/empresas.ts` — sem mudança de assinatura; só passa a gravar `{ nome, ativa }` (o tipo já garante).
4. `src/services/lancamentos.ts`
   - `salvarLancamento(empresaId, data, itens: ItensDoDia)`:
     - valida data, `exigirMesAberto`;
     - valida cada entrada (quantidade inteiro > 0, preço inteiro ≥ 0, nome não vazio);
     - recusa mapa vazio com `'Informe ao menos um item.'`;
     - `totalCentavos = calcularTotal(itens)`;
     - grava com `updateDoc` se o dia existe (substitui `itens` inteiro, preserva `qtdFotos`) ou `setDoc` sem merge se não existe. **Não usar `setDoc` com merge**: ele mesclaria o mapa `itens` antigo e deixaria itens removidos.
   - A tela chama `montarItensDoDia(...)` e passa o resultado; o service não lê o catálogo.
   - `excluirLancamento` e `listarLancamentosDoMes`: sem mudança.
5. `fechamentos.ts`, `fotos.ts`, `relatorios.ts`: sem mudança (conferir que compilam).

## Fase 3 — PDF

`src/lib/pdf.ts`
1. `resumirMes(lancamentos)` → `{ porItem: { itemId, nome, quantidade, valorCentavos }[], totalCentavos }`. Agrupa por `itemId`; o nome é o do lançamento de data mais recente; `porItem` em ordem alfabética.
2. Nova função `quebrarLinhas(fonte, texto, tamanho, largura): string[]` — quebra por palavras (separando itens por " · "), sem cortar nada; palavra maior que a largura é quebrada por caractere. Usa `seguro()`.
3. Tabela dia a dia: colunas `Data` (95) · `Itens` (resto) · `Total do dia` (100).
   - Texto de itens: `"Marmita 2 · Coca lata 1"` (ordem alfabética).
   - Altura da linha = `max(1, linhas) × ALTURA_LINHA`; `garantirEspaco(altura, true)` antes de cada dia. Se um único dia não couber numa página inteira (improvável), deixar continuar na página seguinte linha a linha.
   - Linha "Total": Data = "Total", Itens = total de itens (ex.: "72 itens"), Total = R$ do mês.
4. Bloco "Por tipo de refeição" → **"Por item"**: cabeçalho Item / Quantidade / Valor; uma linha por item, com `garantirEspaco` por linha repetindo o cabeçalho do bloco (não mais "bloco inteiro na mesma página").
5. **Não mexer**: destaque "VALOR TOTAL DO MÊS", `adicionarNotas`, `paginaDeNota`, `legendaNota`, `numerarPaginas`, `gerarPdfDia`, ordem resumo → notas, filtro de dias do mês em `gerarPdfMes`.

## Fase 4 — Telas

1. `src/paginas/Itens.tsx` (nova) — mesmo padrão visual de `Empresas.tsx` (seção "Novo item" com nome + preço; lista com nome, preço, situação; ações Editar / Desativar / Reativar; edição inline com Salvar/Cancelar; mensagens de erro do service).
2. `src/App.tsx` — rota `/itens`. `src/componentes/Moldura.tsx` — link "Itens" ao lado de "Empresas".
3. `src/paginas/Empresas.tsx` — "Nova empresa" só com nome; lista só com nomes; remover tabela de preços.
4. `src/paginas/Empresa.tsx`
   - Remover bloco "Preços padrão" (o componente de edição de preços inteiro).
   - "Total por dia": colunas Data · Itens (`<Itens itens={...} />` com `"Nome qtd"`) · Total do dia; esqueleto de carregamento com 3 colunas; versão mobile usando o mesmo texto.
   - Novo bloco "Total do mês por item" usando `resumirMes` (importar de `lib/pdf` faria carregar o pdf-lib: **mover `resumirMes` para `src/lib/itens.ts`** e o PDF importa de lá).
   - `contarItens` substitui a soma das 4 refeições onde houver total de quantidades (gráfico/linhas).
   - Fechamento: sem mudança.
5. `src/paginas/Dia.tsx`
   - Carga: buscar empresa, lançamento, fechamento **e `listarItens()`** em paralelo.
   - Estado: `textos: Record<itemId, string>` (quantidade digitada) e `busca: string`.
   - Lista exibida: itens já no lançamento (com nome/preço gravados, mesmo inativos/inexistentes no catálogo) primeiro, depois ativos do catálogo que não estão no dia; ambos em ordem alfabética; filtrados por `normalizar(busca)`.
   - Cada linha: nome, preço (somente leitura, `formatarCentavos`), campo de quantidade com `parseQuantidade` e erro por campo.
   - Total ao vivo: `calcularTotal(montarItensDoDia(...))` e `contarItens`.
   - Salvar: `salvarLancamento(empresaId, data, montarItensDoDia(quantidades, catalogo, lancamento?.itens ?? null))`.
   - Sem itens no catálogo: mensagem com link para `/itens`.
   - Mês fechado: tudo somente leitura, como hoje. Notas e "Excluir dia" sem mudança.
6. `npm run build` e `npm run lint` passando. Commit.

## Fase 5 — Testes (browser + emulador)

Atualizar para o modelo novo e rodar uma fase por vez em `main.tsx`:
1. `itens.teste.ts` (novo): criar; nome vazio/101 chars e preço inválido recusados; duplicado "Coca lata" × "coca láta" recusado; editar; desativar e criar outro com o mesmo nome; reativar o antigo recusado por duplicidade.
2. `regras-itens.teste.ts` (novo): criar/editar válido passa; campo extra, preço negativo/fracionário, nome vazio, sem `ativo` falham; delete falha; sem login/sem acesso falha.
3. `lancamentos.teste.ts`: total correto; quantidade 0 descartada; dia vazio recusado; remover um item do dia some do documento (garante que não houve merge); `qtdFotos` preservado ao salvar; `montarItensDoDia` mantém preço gravado de item já lançado após mudar o preço no catálogo e usa o preço novo para item novo.
4. `regras-lancamentos.teste.ts`: válido passa; `itens` vazio, campo extra, sem `totalCentavos`, total negativo falham; merge de `qtdFotos` passa; mês fechado bloqueia.
5. `regras-empresas.teste.ts` / `empresas.teste.ts`: só `nome` e `ativa`; `precosPadrao` agora é campo extra → falha.
6. `fechamento.teste.ts`, `regras-fechamento.teste.ts`, `fotos.teste.ts`, `regras-fotos.teste.ts`: trocar a criação de lançamentos para o formato novo; o comportamento esperado não muda.
7. `pdf.teste.ts`: dia com ~25 itens de nomes longos → todo nome aparece no texto extraído (nada com "…"); "Por item" agrupa por `itemId` e usa o nome mais recente; total do mês correto; páginas de notas continuam depois do resumo, em ordem de data; PDF do dia igual.
8. Deixar em `main.tsx` a fase nova ativa e as anteriores comentadas, como o padrão do arquivo. Commit.

## Fase 6 — Conferência manual e publicação

1. No emulador: cadastrar 3 itens, 2 empresas; lançar dias diferentes em cada uma (marmita + coca num dia, só coca no outro); conferir que os totais por item não se misturam entre empresas; renomear e mudar preço de um item e conferir que os dias antigos não mudaram; gerar PDF do mês, apagar notas, conferir o mês travado.
2. Antes de publicar: **confirmar com a usuária** a limpeza dos dados de teste em produção (`empresas` e subcoleções) — é irreversível.
3. `npx firebase deploy --only firestore:rules,hosting` — só com o OK da usuária.
