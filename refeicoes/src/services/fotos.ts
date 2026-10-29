import {
    collection, doc, getDoc, getDocs, query, orderBy, limit, writeBatch, increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import { comprimirImagem } from '../lib/imagem';
import { exigirMesAberto } from './fechamentos';
import type { Foto } from '../types';

const COLECAO_EMPRESAS = 'empresas';
const COLECAO_LANCAMENTOS = 'lancamentos';
const COLECAO_FOTOS = 'fotos';

// o Firestore recusa requisições acima de 10 MiB; cada batch fica abaixo de ~8 MB
const LIMITE_BYTES_BATCH = 8_000_000;
// nome dos campos, ordem e o caminho do documento
const FOLGA_POR_FOTO = 1_000;

function refLancamento(empresaId: string, data: string) {
    return doc(db, COLECAO_EMPRESAS, empresaId, COLECAO_LANCAMENTOS, data);
}

function colecaoFotos(empresaId: string, data: string) {
    return collection(refLancamento(empresaId, data), COLECAO_FOTOS);
}

export async function listarFotos(empresaId: string, data: string): Promise<Foto[]> {
    const resultado = await getDocs(query(colecaoFotos(empresaId, data), orderBy('ordem')));
    return resultado.docs.map((d) => ({ id: d.id, ...d.data() }) as Foto);
}

async function maiorOrdem(empresaId: string, data: string): Promise<number> {
    const q = query(colecaoFotos(empresaId, data), orderBy('ordem', 'desc'), limit(1));
    const resultado = await getDocs(q);
    return resultado.empty ? 0 : (resultado.docs[0].data().ordem as number);
}

export async function adicionarFotos(empresaId: string, data: string, arquivos: File[]): Promise<void> {
    await exigirMesAberto(empresaId, data);
    const lancamento = refLancamento(empresaId, data);
    const snap = await getDoc(lancamento);
    if (!snap.exists()) throw new Error('Salve o lançamento do dia antes de adicionar notas.');
    if (arquivos.length === 0) return;

    // uma por vez: comprimir várias fotos grandes ao mesmo tempo estoura a memória do celular
    const dataUrls: string[] = [];
    for (const arquivo of arquivos) dataUrls.push(await comprimirImagem(arquivo));

    let ordem = await maiorOrdem(empresaId, data);
    let batch = writeBatch(db);
    let qtdNoBatch = 0;
    let bytesNoBatch = 0;

    // cada batch leva o seu próprio increment: fotos e contador gravam juntos ou nada grava
    async function gravar() {
        batch.update(lancamento, { qtdFotos: increment(qtdNoBatch) });
        await batch.commit();
    }

    for (const dataUrl of dataUrls) {
        const tamanho = dataUrl.length + FOLGA_POR_FOTO;
        if (qtdNoBatch > 0 && bytesNoBatch + tamanho > LIMITE_BYTES_BATCH) {
            await gravar();
            batch = writeBatch(db);
            qtdNoBatch = 0;
            bytesNoBatch = 0;
        }
        ordem += 1;
        batch.set(doc(colecaoFotos(empresaId, data)), { dataUrl, ordem });
        qtdNoBatch += 1;
        bytesNoBatch += tamanho;
    }
    await gravar();
}

export async function removerFoto(empresaId: string, data: string, fotoId: string): Promise<void> {
    await exigirMesAberto(empresaId, data);
    const foto = doc(colecaoFotos(empresaId, data), fotoId);
    // foto já removida (clique duplo, outra aba): não descontar de novo do contador
    const snap = await getDoc(foto);
    if (!snap.exists()) return;

    const batch = writeBatch(db);
    batch.delete(foto);
    batch.update(refLancamento(empresaId, data), { qtdFotos: increment(-1) });
    await batch.commit();
}
