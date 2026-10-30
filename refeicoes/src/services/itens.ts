import { collection, doc, getDoc, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { normalizar, ordenarPorNome } from '../lib/itens';
import type { Item } from '../types';

const COLECAO_ITENS = 'itens';
const NOME_MAXIMO = 100;

type DadosItem = { nome: string; precoCentavos: number };

function colecaoItens() {
    return collection(db, COLECAO_ITENS);
}

export async function listarItens(): Promise<Item[]> {
    const resultado = await getDocs(colecaoItens());
    return ordenarPorNome(resultado.docs.map((d) => ({ id: d.id, ...d.data() }) as Item));
}

// devolve os dados limpos ou lança o erro que a tela mostra
function validar(dados: DadosItem): DadosItem {
    const nome = dados.nome.trim().replace(/\s+/g, ' ');
    if (!nome) throw new Error('Informe o nome do item.');
    if (nome.length > NOME_MAXIMO) throw new Error(`Use no máximo ${NOME_MAXIMO} caracteres.`);
    if (!Number.isSafeInteger(dados.precoCentavos) || dados.precoCentavos < 0) throw new Error('Preço inválido.');
    return { nome, precoCentavos: dados.precoCentavos };
}

// As regras não conseguem conferir isso: dois itens ativos não podem ter o mesmo nome
// (sem diferenciar maiúsculas e acentos). ignorarId: o próprio item, ao editar ou reativar.
async function exigirNomeLivre(nome: string, ignorarId?: string): Promise<void> {
    const alvo = normalizar(nome);
    const itens = await listarItens();
    if (itens.some((i) => i.ativo && i.id !== ignorarId && normalizar(i.nome) === alvo)) {
        throw new Error('Já existe um item ativo com esse nome.');
    }
}

export async function criarItem(dados: DadosItem): Promise<string> {
    const limpo = validar(dados);
    await exigirNomeLivre(limpo.nome);
    const ref = await addDoc(colecaoItens(), { ...limpo, ativo: true });
    return ref.id;
}

export async function atualizarItem(id: string, dados: DadosItem): Promise<void> {
    const limpo = validar(dados);
    const snap = await getDoc(doc(colecaoItens(), id));
    if (!snap.exists()) throw new Error('Item não encontrado.');
    if (snap.data().ativo) await exigirNomeLivre(limpo.nome, id);
    await updateDoc(doc(colecaoItens(), id), limpo);
}

export async function definirAtivo(id: string, ativo: boolean): Promise<void> {
    const snap = await getDoc(doc(colecaoItens(), id));
    if (!snap.exists()) throw new Error('Item não encontrado.');
    if (ativo) await exigirNomeLivre(snap.data().nome as string, id);
    await updateDoc(doc(colecaoItens(), id), { ativo });
}
