import { REFEICOES, type PorRefeicao, type Refeicao } from '../types';
import { formatarCentavos, parseReais } from './dinheiro';

export const NOMES_REFEICOES: Record<Refeicao, string> = {
    cafeManha: 'Café da manhã',
    almoco: 'Almoço',
    cafeTarde: 'Café da tarde',
    janta: 'Janta',
};

// Texto digitado em cada campo, por refeição (o que a usuária vê no formulário)
export type TextoPorRefeicao = Record<Refeicao, string>;

export function textoVazio(): TextoPorRefeicao {
    return { cafeManha: '', almoco: '', cafeTarde: '', janta: '' };
}

// 2250 → "22,50" (para preencher um campo de preço)
export function centavosParaTexto(centavos: number): string {
    return formatarCentavos(centavos).replace(/^R\$\s*/, '');
}

export function precosParaTexto(precos: PorRefeicao): TextoPorRefeicao {
    const t = textoVazio();
    for (const r of REFEICOES) t[r] = centavosParaTexto(precos[r]);
    return t;
}

// "12" → 12, "" → 0, "2,5" / "-1" / "abc" → null
export function parseQuantidade(texto: string): number | null {
    const t = texto.trim();
    if (t === '') return 0;
    if (!/^\d+$/.test(t)) return null;
    const n = Number(t);
    return Number.isSafeInteger(n) ? n : null;
}

// Converte os 4 campos; devolve os valores e, para cada campo inválido, o erro
export function converterCampos(
    textos: TextoPorRefeicao,
    converter: (texto: string) => number | null,
): { valores: PorRefeicao; invalidos: Refeicao[] } {
    const valores: PorRefeicao = { cafeManha: 0, almoco: 0, cafeTarde: 0, janta: 0 };
    const invalidos: Refeicao[] = [];
    for (const r of REFEICOES) {
        const v = converter(textos[r]);
        if (v === null) invalidos.push(r);
        else valores[r] = v;
    }
    return { valores, invalidos };
}

export function converterPrecos(textos: TextoPorRefeicao) {
    return converterCampos(textos, parseReais);
}

export function converterQuantidades(textos: TextoPorRefeicao) {
    return converterCampos(textos, parseQuantidade);
}
