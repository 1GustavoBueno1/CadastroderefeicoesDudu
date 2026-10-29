import {
    collection, doc, getDoc, getDocs, setDoc, query, where, orderBy, documentId, writeBatch, increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import { exigirMesAberto } from './fechamentos';
import { REFEICOES, calcularTotal, type Lancamento, type PorRefeicao } from '../types';

const COLECAO_EMPRESAS = 'empresas';
const COLECAO_LANCAMENTOS = 'lancamentos';
const COLECAO_FOTOS = 'fotos';
const LIMITE_OPERACOES_BATCH = 500;

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
    await exigirMesAberto(empresaId, data);
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

export async function excluirLancamento(empresaId: string, data: string): Promise<void> {
    await exigirMesAberto(empresaId, data);
    const lancamento = doc(colecaoLancamentos(empresaId), data);
    const fotos = (await getDocs(collection(lancamento, COLECAO_FOTOS))).docs.map((d) => d.ref);

    // Com muitas fotos, os batches de fotos vão antes e cada um desconta o que apagou do qtdFotos
    // (1 operação a mais): se algum falhar no meio, o contador continua batendo com as fotos que sobraram.
    // O último batch apaga o resto das fotos e o lançamento.
    const porBatch = LIMITE_OPERACOES_BATCH - 1;
    let i = 0;
    while (fotos.length - i > porBatch) {
        const parte = fotos.slice(i, i + porBatch);
        const batch = writeBatch(db);
        for (const ref of parte) batch.delete(ref);
        batch.update(lancamento, { qtdFotos: increment(-parte.length) });
        await batch.commit();
        i += porBatch;
    }
    const batch = writeBatch(db);
    for (const ref of fotos.slice(i)) batch.delete(ref);
    batch.delete(lancamento);
    await batch.commit();
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
