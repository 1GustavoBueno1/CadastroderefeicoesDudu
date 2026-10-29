import {
    collection, doc, getDoc, getDocs, query, where, orderBy, documentId, writeBatch, serverTimestamp,
    type DocumentReference, type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Fechamento, Lancamento } from '../types';

const COLECAO_EMPRESAS = 'empresas';
const COLECAO_LANCAMENTOS = 'lancamentos';
const COLECAO_FOTOS = 'fotos';
const COLECAO_FECHAMENTOS = 'fechamentos';
const LIMITE_OPERACOES_BATCH = 500;

const FORMATO_MES = /^\d{4}-\d{2}$/;

function refFechamento(empresaId: string, mes: string) {
    return doc(db, COLECAO_EMPRESAS, empresaId, COLECAO_FECHAMENTOS, mes);
}

export async function buscarFechamento(empresaId: string, mes: string): Promise<Fechamento | null> {
    const snap = await getDoc(refFechamento(empresaId, mes));
    if (!snap.exists()) return null;
    // 'estimate': logo depois de fechar, o horário do servidor pode ainda não ter chegado ao cache local
    const d = snap.data({ serverTimestamps: 'estimate' });
    return {
        mes: snap.id,
        totalCentavos: d.totalCentavos,
        qtdNotas: d.qtdNotas,
        fechadoEm: (d.fechadoEm as Timestamp).toDate(),
    };
}

// Trava dos services de edição: data é 'AAAA-MM-DD'
export async function exigirMesAberto(empresaId: string, data: string): Promise<void> {
    if (await buscarFechamento(empresaId, data.slice(0, 7))) throw new Error('Mês fechado. Não é possível editar.');
}

export async function apagarNotasDoMes(empresaId: string, mes: string): Promise<void> {
    if (!FORMATO_MES.test(mes)) throw new Error('Mês inválido.');
    if (await buscarFechamento(empresaId, mes)) throw new Error('Este mês já foi fechado.');

    const lancamentos = collection(db, COLECAO_EMPRESAS, empresaId, COLECAO_LANCAMENTOS);
    const resultado = await getDocs(query(
        lancamentos,
        where(documentId(), '>=', `${mes}-01`),
        where(documentId(), '<=', `${mes}-31`),
        orderBy(documentId()),
    ));

    let totalCentavos = 0;
    let qtdNotas = 0;
    const zerar: DocumentReference[] = [];
    for (const d of resultado.docs) {
        const l = d.data() as Omit<Lancamento, 'data'>;
        totalCentavos += l.totalCentavos;
        const qtd = l.qtdFotos ?? 0;
        qtdNotas += qtd;
        if (qtd !== 0) zerar.push(d.ref);
    }
    // todas as fotos que existem de fato (não só as dos dias com qtdFotos > 0)
    const fotos = (await Promise.all(
        resultado.docs.map((d) => getDocs(collection(d.ref, COLECAO_FOTOS))),
    )).flatMap((r) => r.docs.map((f) => f.ref));

    // O último batch leva o resto das fotos, os qtdFotos zerados e o fechamento, tudo junto.
    // - O fechamento pode ir no mesmo batch das exclusões: as regras usam exists(), que enxerga o banco
    //   de ANTES do batch, então a trava só passa a valer depois dele.
    // - Os contadores só são zerados nesse último batch: se a operação parar no meio (mês com mais de
    //   ~470 notas, em vários batches), chamar de novo recalcula qtdNotas com os contadores intactos
    //   e apaga o que sobrou. Nesse intervalo o qtdFotos fica maior que o número de fotos que restam.
    const capacidadeDoUltimo = LIMITE_OPERACOES_BATCH - zerar.length - 1;
    let i = 0;
    while (fotos.length - i > capacidadeDoUltimo) {
        const batch = writeBatch(db);
        for (const ref of fotos.slice(i, i + LIMITE_OPERACOES_BATCH)) batch.delete(ref);
        await batch.commit();
        i += LIMITE_OPERACOES_BATCH;
    }
    const batch = writeBatch(db);
    for (const ref of fotos.slice(i)) batch.delete(ref);
    for (const ref of zerar) batch.update(ref, { qtdFotos: 0 });
    batch.set(refFechamento(empresaId, mes), { totalCentavos, qtdNotas, fechadoEm: serverTimestamp() });
    await batch.commit();
}
