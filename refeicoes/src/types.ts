export type Item = {
    id: string,
    nome: string,
    precoCentavos: number,
    ativo: boolean
}

// nome e preço copiados do catálogo quando o item entrou no dia
export type ItemDoDia = {
    nome: string,
    quantidade: number,
    precoCentavos: number
}

// chave = id do item no catálogo
export type ItensDoDia = Record<string, ItemDoDia>

export type Empresa = {
    id: string,
    nome: string,
    ativa: boolean
}

export type Lancamento = {
    data: string,
    itens: ItensDoDia,
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

export function calcularTotal(itens: ItensDoDia): number {
    let total = 0
    for (const i of Object.values(itens)) {
        total += i.quantidade * i.precoCentavos
    }
    return total
}
