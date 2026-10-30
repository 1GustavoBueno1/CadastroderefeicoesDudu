# Itens por empresa (substitui as 4 refeições fixas)

Data: 2026-10-30
App: `refeicoes/`

## Problema

O sistema foi feito em torno de 4 refeições fixas (café da manhã, almoço, café da tarde, janta), com preço padrão por empresa. O uso real é por **itens**: num dia uma empresa leva 1 marmita e 1 coca lata, no outro só a coca. O sistema precisa permitir cadastrar itens e lançar, por dia e por empresa, a quantidade de cada item. No fim do mês, os totais por item de cada empresa são conferidos com o que a empresa registrou.

## Decisões

- **Catálogo único de itens**, compartilhado por todas as empresas. Cada item tem **um preço único** (igual para todas as empresas).
- **Quantidades e totais são por empresa**, nunca misturados entre empresas. Não há controle por funcionário.
- O sistema mostra **quantidades e valores em R$**; a conferência é pelas quantidades.
- O preço e o nome do item são **copiados para o lançamento do dia** ao salvar. Mudar o preço ou o nome no catálogo não altera dias já lançados.
- Itens podem ser **editados (nome, preço) e desativados/reativados, nunca apagados**. Item desativado some da tela de lançamento, mas continua aparecendo nos dias que já o usaram.
- **Sem migração**: os dados atuais são de teste. O modelo antigo é descartado. O emulador começa limpo e a produção é limpa manualmente antes de publicar.
- **Fechamento do mês não muda** (resumo exibido; conferência feita por fora).
- **PDF: a função principal não muda** (ver seção PDF).

## Modelo de dados (Firestore)

```
itens/{itemId}
  { nome: string, precoCentavos: int, ativo: bool }

empresas/{empresaId}
  { nome: string, ativa: bool }                      // sai precosPadrao

empresas/{empresaId}/lancamentos/{AAAA-MM-DD}
  { itens: { [itemId]: { nome: string, quantidade: int, precoCentavos: int } },
    totalCentavos: int,
    qtdFotos?: int }

empresas/{empresaId}/lancamentos/{data}/fotos/{fotoId}   // sem mudança
empresas/{empresaId}/fechamentos/{AAAA-MM}               // sem mudança
```

Regras do lançamento (garantidas no service):
- Só itens com `quantidade > 0` são gravados.
- Dia sem nenhum item com quantidade > 0 não é salvo (erro "Informe ao menos um item."). Para remover um dia usa-se "Excluir dia".
- `totalCentavos = Σ quantidade × precoCentavos`.
- Ao salvar um dia existente: item que já estava no dia mantém o `precoCentavos` e o `nome` gravados; item novo no dia usa nome e preço atuais do catálogo.
- O salvamento substitui o mapa `itens` inteiro (não faz merge dentro de `itens`), preservando `qtdFotos`.

Nome de item duplicado: não pode haver dois itens **ativos** com o mesmo nome, comparando sem diferenciar maiúsculas e acentos. Verificado no service (as regras não conseguem).

## Telas

**Itens** (`/itens`, nova; link no topo junto de "Empresas")
- Lista do catálogo: nome, preço, ativo/inativo. Ordem alfabética, ativos primeiro.
- Formulário "Novo item": nome + preço.
- Em cada item: editar (nome, preço) e desativar/reativar.

**Empresas** (`/`)
- "Nova empresa" pede só o nome.
- A lista mostra só os nomes (sai a tabela "Preços padrão por empresa").

**Empresa** (`/empresas/:id`)
- Sai o bloco "Preços padrão".
- "Total por dia": colunas **Data · Itens · Total do dia**. Itens em texto corrido ("Marmita 2 · Coca lata 1"), com o componente `Itens` existente.
- Bloco novo **"Total do mês por item"**: item, quantidade, valor; e total geral.
- Gráfico do mês continua mostrando o total do dia.
- Bloco de fechamento (gerar PDF → apagar notas → mês travado) **sem mudança**.

**Dia** (`/empresas/:id/dia/:data`)
- Busca no topo que filtra por nome (sem diferenciar maiúsculas e acentos).
- Lista: primeiro os itens já lançados no dia (mesmo se desativados depois), depois os demais itens ativos, em ordem alfabética. Cada um com campo de quantidade e preço só para leitura.
- Sai o campo de preço editável por dia.
- Total do dia ("N itens · R$ X"), notas/fotos e "Excluir dia" sem mudança.

## PDF

Função principal mantida: o **PDF do mês** é o arquivo da empresa naquele mês — resumo + **todas as notas da empresa naquele mês**, em ordem de data — e precisa ser gerado antes de "Apagar notas do mês". O **PDF do dia** (só as notas do dia) não muda.

Mudanças apenas no resumo do mês:
- Tabela dia a dia: **Data · Itens · Total do dia**. A coluna Itens quebra em várias linhas quando não cabe — **nada é cortado**. A linha do dia cresce conforme necessário; quebra de página repete o cabeçalho.
- "Por tipo de refeição" vira **"Por item"** (nome, quantidade, valor; ordem alfabética). Pode continuar na página seguinte, repetindo o cabeçalho.
- Sem mudança: destaque "VALOR TOTAL DO MÊS", páginas de notas, legendas, numeração.

`resumirMes` passa a devolver os totais por item (`{ itemId, nome, quantidade, valorCentavos }[]`) e o total geral. Quando o mesmo item aparece com nomes diferentes em dias diferentes (renomeado no meio do mês), agrupa por `itemId` e usa o nome do lançamento mais recente.

## Regras do Firestore

- `itens/{id}`: leitura para `autorizado()`; create/update para `autorizado()` com `itemValido` (só `nome` 1–100 caracteres, `precoCentavos` int ≥ 0, `ativo` bool); delete negado.
- `empresas/{id}`: `empresaValida` passa a aceitar só `nome` e `ativa`.
- `lancamentos/{data}`: `lancamentoValido` exige `itens` como map, `totalCentavos` int ≥ 0, `qtdFotos` opcional int ≥ 0, sem outros campos. As regras não têm laço, então **não** conferem a soma do total nem cada entrada do mapa; isso fica no service, coberto por teste. Trava de mês fechado sem mudança.
- `fotos` e `fechamentos`: sem mudança.
- Atualizar as duas cópias (`refeicoes/firestore.rules` e `refeicoes/src/firestore.rules`) ou unificar numa só, se a segunda não for usada.

## Código

- `types.ts`: sai `Refeicao`, `REFEICOES`, `PorRefeicao`. Entram `Item` e `ItemDoDia`; `Empresa` sem `precosPadrao`; `Lancamento.itens: Record<string, ItemDoDia>`. `calcularTotal` soma o mapa.
- `lib/refeicoes.ts` → `lib/itens.ts`: `parseQuantidade`, `centavosParaTexto`, normalização para busca/duplicidade, ordenação.
- `services/itens.ts` (novo): `listarItens`, `criarItem`, `atualizarItem`, `definirAtivo`.
- `services/empresas.ts`: sem preços.
- `services/lancamentos.ts`: `salvarLancamento(empresaId, data, quantidades: Record<itemId, number>, catalogo, lancamentoAtual)` monta o mapa `itens` conforme as regras acima.
- `componentes/CamposPrecos.tsx`: removido.
- Páginas: `Itens.tsx` (nova), ajustes em `Empresas`, `Empresa`, `Dia`; rota e link em `App`/`Moldura`.
- `fechamentos.ts`, `fotos.ts`, `relatorios.ts`: sem mudança de comportamento.

## Testes

- Atualizar: `lancamentos`, `empresas`, `pdf`, `fechamento`, `regras-empresas`, `regras-lancamentos`, `regras-fechamento`, `regras-fotos`.
- Novos: `itens.teste.ts` (criar, editar, desativar, duplicidade sem acento/maiúscula), `regras-itens.teste.ts`.
- Lançamentos: descarta quantidade 0; recusa dia vazio; mantém preço gravado de item já lançado; usa preço atual para item novo; total correto; preserva `qtdFotos`.
- PDF: dia com muitos itens não é cortado (texto quebra em linhas); "Por item" agrupa por `itemId`; notas continuam após o resumo, em ordem de data.

## Fora do escopo

- Preço por empresa.
- Comparação automática no fechamento entre o lançado e o informado pela empresa.
- Controle por funcionário.
- Migração de dados antigos.
