import type { Item, ItensDoDia, Lancamento } from '../types';
import { formatarCentavos } from './dinheiro';

// 2250 → "22,50" (para preencher um campo de preço)
export function centavosParaTexto(centavos: number): string {
    return formatarCentavos(centavos).replace(/^R\$\s*/, '');
}

// "12" → 12, "" → 0, "2,5" / "-1" / "abc" → null
export function parseQuantidade(texto: string): number | null {
    const t = texto.trim();
    if (t === '') return 0;
    if (!/^\d+$/.test(t)) return null;
    const n = Number(t);
    return Number.isSafeInteger(n) ? n : null;
}

// para busca e nome duplicado: "  Coca  Láta " e "coca lata" são iguais
export function normalizar(texto: string): string {
    return texto
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

export function compararNomes(a: string, b: string): number {
    return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
}

export function ordenarPorNome<T extends { nome: string }>(lista: T[]): T[] {
    return [...lista].sort((a, b) => compararNomes(a.nome, b.nome));
}

export function contarItens(itens: ItensDoDia): number {
    return Object.values(itens).reduce((s, i) => s + i.quantidade, 0);
}

// "Coca lata 1 · Marmita 2" (em ordem alfabética), para tabela e PDF
export function textosDoDia(itens: ItensDoDia): string[] {
    return ordenarPorNome(Object.values(itens)).map((i) => `${i.nome} ${i.quantidade}`);
}

// Monta o que vai ser gravado no dia a partir das quantidades digitadas (por id do item):
// - quantidade 0 não entra;
// - item que já estava no dia mantém o nome e o preço gravados (mudar o catálogo não muda dias já lançados);
// - item novo no dia leva o nome e o preço atuais do catálogo.
export function montarItensDoDia(
    quantidades: Record<string, number>,
    catalogo: Item[],
    atual: ItensDoDia | null,
): ItensDoDia {
    const porId = new Map(catalogo.map((i) => [i.id, i]));
    const itens: ItensDoDia = {};
    for (const [id, quantidade] of Object.entries(quantidades)) {
        if (quantidade === 0) continue;
        const gravado = atual?.[id];
        if (gravado) {
            itens[id] = { nome: gravado.nome, precoCentavos: gravado.precoCentavos, quantidade };
            continue;
        }
        const doCatalogo = porId.get(id);
        if (!doCatalogo) throw new Error('Item desconhecido.');
        itens[id] = { nome: doCatalogo.nome, precoCentavos: doCatalogo.precoCentavos, quantidade };
    }
    return itens;
}

export type TotalDoItem = { itemId: string; nome: string; quantidade: number; valorCentavos: number };
export type ResumoMes = { porItem: TotalDoItem[]; totalCentavos: number };

// Totais do mês com os preços gravados em cada lançamento (não o preço atual do catálogo).
// Agrupa por id: um item renomeado no meio do mês aparece uma vez só, com o nome do dia mais recente.
export function resumirMes(lancamentos: Lancamento[]): ResumoMes {
    const porId = new Map<string, TotalDoItem>();
    // data do lançamento de onde veio o nome atual de cada item
    const dataDoNome = new Map<string, string>();
    let totalCentavos = 0;
    for (const l of lancamentos) {
        for (const [itemId, i] of Object.entries(l.itens)) {
            const t = porId.get(itemId) ?? { itemId, nome: i.nome, quantidade: 0, valorCentavos: 0 };
            t.quantidade += i.quantidade;
            t.valorCentavos += i.quantidade * i.precoCentavos;
            if (l.data >= (dataDoNome.get(itemId) ?? '')) {
                t.nome = i.nome;
                dataDoNome.set(itemId, l.data);
            }
            porId.set(itemId, t);
        }
        totalCentavos += l.totalCentavos;
    }
    return { porItem: ordenarPorNome([...porId.values()]), totalCentavos };
}
