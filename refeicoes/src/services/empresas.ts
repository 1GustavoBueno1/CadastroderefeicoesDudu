import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc, query, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Empresa} from '../types';

export async function listarEmpresas(): Promise<Empresa[]> {
    const q = query(collection(db, 'empresas'), orderBy('nome'));
    const resultado = await getDocs(q);
    return resultado.docs.map((d) => ({ id: d.id, ...d.data()}) as Empresa);
}
export async function buscarEmpresa(id: string): Promise<Empresa | null> {
    const snap = await getDoc(doc(db, 'empresas', id));
    if (!snap.exists()) return null
    return {id: snap.id, ...snap.data() } as Empresa
}

export async function  criarEmpresa(dados: Omit<Empresa, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'empresas'), {
        ...dados, nome: dados.nome.trim()})
    return ref.id
}

export async function atualizarEmpresa(
    id: string,
    campos: Partial<Omit<Empresa, 'id'>>,
): Promise<void>{
    await updateDoc(doc(db, 'empresas', id), campos)
}