import {
    collection, doc, getDoc, getDocs, setDoc, query, where, orderBy, documentId,
} from 'firebase/firestore';
import { db } from '../firebase';
import { REFEICOES, calcularTotal, type Lancamento, type PorRefeicao } from '../types';

const COLECAO_EMPRESAS = 'empresas';
const COLECAO_LANCAMENTOS = 'lancamentos';

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_MES = /^\d{4}-\d{2}$/;

function colecaoLancamentos(empresaId: string) {
    return collection(db, COLECAO_EMPRESAS, empresaId, COLECAO_LANCAMENTOS);
}

function inteiroNaoNegativo(x: number): boolean {
    return Number.isInteger(x) && x >= 0;
}

export async function buscarLancamento(empresaId: string, data: string): Promise<Lancamento | null> {
    const snap = await getDoc(doc(colecaoLancamentos(empresaId), data));
    if (!snap.exists()) return null
    return { data: snap.id, ...snap.data() } as Lancamento
}

export async function salvarLancamento(
    empresaId: string,
    data: string,
    quantidades: PorRefeicao,
    precos: PorRefeicao,
): Promise<void> {
    if (!FORMATO_DATA.test(data)) throw new Error('Data inválida.');
    for (const r of REFEICOES) {
        if (!inteiroNaoNegativo(quantidades[r])) throw new Error('Quantidade inválida.');
        if (!inteiroNaoNegativo(precos[r])) throw new Error('Preço inválido.');
    }
    const totalCentavos = calcularTotal(quantidades, precos);
    // merge: não apagar qtdFotos, que é de outro service
    await setDoc(
        doc(colecaoLancamentos(empresaId), data),
        { quantidades, precos, totalCentavos },
        { merge: true },
    );
}

export async function listarLancamentosDoMes(empresaId: string, mes: string): Promise<Lancamento[]> {
    if (!FORMATO_MES.test(mes)) throw new Error('Mês inválido.');
    const q = query(
        colecaoLancamentos(empresaId),
        where(documentId(), '>=', `${mes}-01`),
        where(documentId(), '<=', `${mes}-31`),
        orderBy(documentId()),
    );
    const resultado = await getDocs(q);
    return resultado.docs.map((d) => ({ data: d.id, ...d.data() }) as Lancamento);
}
