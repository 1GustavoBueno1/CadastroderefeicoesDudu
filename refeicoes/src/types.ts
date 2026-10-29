export type Refeicao = 'cafeManha' | 'almoco' | 'cafeTarde' | 'janta';
export const REFEICOES: Refeicao[] = ['cafeManha', 'almoco', 'cafeTarde', 'janta'];
export type PorRefeicao = Record<Refeicao, number>

export type Empresa = {
    id: string,
    nome: string,
    precosPadrao: PorRefeicao,
    ativa: boolean
}

export type Lancamento = {
    data: string,
    quantidades: PorRefeicao,
    precos: PorRefeicao,
    totalCentavos: number,
    qtdFotos?: number
}

export type Foto = {
    id: string,
    dataUrl: string,
    ordem: number
}

export type Fechamento = {
    mes: string,
    totalCentavos: number,
    qtdNotas: number,
    fechadoEm: Date
}

export function calcularTotal(quantidades: PorRefeicao, precos: PorRefeicao): number {
    let total = 0
    for (const r of REFEICOES) {
        total += quantidades[r] * precos[r]
    }
    return total
}