// Datas sempre como string 'AAAA-MM-DD' / 'AAAA-MM'. Nunca new Date('AAAA-MM-DD'): isso lê em UTC e,
// no fuso do Brasil, cai no dia anterior.

const NOMES_MESES = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const FORMATO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const FORMATO_MES = /^(\d{4})-(\d{2})$/;

function doisDigitos(n: number): string {
    return String(n).padStart(2, '0');
}

// Um instante (ex.: fechadoEm) → 'AAAA-MM-DD' no fuso local
export function dataLocal(d: Date): string {
    return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

export function hoje(): string {
    return dataLocal(new Date());
}

export function mesAtual(): string {
    return hoje().slice(0, 7);
}

export function dataValida(data: string): boolean {
    const m = FORMATO_DATA.exec(data);
    if (!m) return false;
    const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return mes >= 1 && mes <= 12 && dia >= 1 && dia <= diasNoMes(`${m[1]}-${m[2]}`) && ano > 0;
}

export function mesValido(mes: string): boolean {
    const m = FORMATO_MES.exec(mes);
    return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

export function diasNoMes(mes: string): number {
    const [ano, m] = mes.split('-').map(Number);
    // dia 0 do mês seguinte = último dia deste mês (construtor local, sem fuso)
    return new Date(ano, m, 0).getDate();
}

export function somarMeses(mes: string, quantos: number): string {
    const [ano, m] = mes.split('-').map(Number);
    const total = ano * 12 + (m - 1) + quantos;
    return `${Math.floor(total / 12)}-${doisDigitos((total % 12) + 1)}`;
}

// '2026-10' → 'outubro de 2026'
export function nomeDoMes(mes: string): string {
    const [ano, m] = mes.split('-').map(Number);
    return `${NOMES_MESES[m - 1]} de ${ano}`;
}

// '2026-10-05' → '05/10/2026'
export function formatarData(data: string): string {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
}

// '2026-10-05' → 'seg'
export function diaDaSemana(data: string): string {
    const [ano, mes, dia] = data.split('-').map(Number);
    return DIAS_SEMANA[new Date(ano, mes - 1, dia).getDay()];
}

// '2026-10-05' → 'segunda, 5 de outubro de 2026'
export function dataPorExtenso(data: string): string {
    const [ano, mes, dia] = data.split('-').map(Number);
    const semana = new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', '');
    return `${semana}, ${dia} de ${NOMES_MESES[mes - 1]} de ${ano}`;
}
