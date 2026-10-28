const formatoBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// "22,50" | "1.234,56" | "R$ 22,50"  → vírgula decimal, ponto de milhar
const COM_VIRGULA = /^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/;
// "22.50" → ponto decimal
const PONTO_DECIMAL = /^\d+\.\d{1,2}$/;
// "1.234" → ponto de milhar, sem centavos
const PONTO_MILHAR = /^\d{1,3}(\.\d{3})+$/;
const SO_DIGITOS = /^\d+$/;

export function parseReais(texto: string): number | null {
    const t = texto.replace(/R\$/i, '').replace(/\s/g, '');
    if (t === '') return 0;

    let normalizado: string;
    if (t.includes(',')) {
        if (!COM_VIRGULA.test(t)) return null;
        normalizado = t.replace(/\./g, '').replace(',', '.');
    } else if (PONTO_DECIMAL.test(t)) {
        normalizado = t;
    } else if (PONTO_MILHAR.test(t)) {
        normalizado = t.replace(/\./g, '');
    } else if (SO_DIGITOS.test(t)) {
        normalizado = t;
    } else {
        return null;
    }

    const centavos = Math.round(Number(normalizado) * 100);
    return Number.isSafeInteger(centavos) ? centavos : null;
}

export function formatarCentavos(centavos: number): string {
    return formatoBRL.format(centavos / 100);
}
