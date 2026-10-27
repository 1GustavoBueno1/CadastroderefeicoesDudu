export type Refeicao = 'cafeManha' | 'almoco' | 'cafeTarde' | 'janta';

export type porRefeicao = Record<Refeicao, number>

export type Empresa = {
    id: string,
    nome: string,
    precosPadrao: porRefeicao,
    ativa: boolean
}

export type lancamento = {
    data: string,
    quantidades: porRefeicao,
    precos: porRefeicao,
    totalCentavos: number,
    qtdFotos: number
}

export type Foto = {
    id: string,
    dataUrl: string,
    ordem: number
}

export type fechamento = {
    mes: string,
    totalCentavos: number,
    qtdNotas: number,
    fechadoEm: Date
}