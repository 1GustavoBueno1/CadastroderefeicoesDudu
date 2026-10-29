import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { entrar } from '../services/auth';

const precos = { cafeManha: 850, almoco: 2200, cafeTarde: 850, janta: 2000 };
const empresaBoa = { nome: 'Teste Regras', precosPadrao: precos, ativa: true };
const empresas = collection(db, 'empresas');

async function devePassar(descricao: string, operacao: () => Promise<unknown>) {
  try {
    await operacao();
    console.log('✅', descricao);
  } catch (e) {
    console.log('❌', descricao, '→ foi bloqueado, mas deveria passar:', (e as Error).message);
  }
}

async function deveFalhar(descricao: string, operacao: () => Promise<unknown>) {
  try {
    await operacao();
    console.log('❌', descricao, '→ GRAVOU, mas a regra deveria bloquear!');
  } catch {
    console.log('✅', descricao);
  }
}

export async function rodarTesteRegrasEmpresas() {
  await entrar('teste@teste.com', '123456');
  console.log('--- regras de empresas ---');

  // o que é válido tem que passar
  const ref = await addDoc(empresas, empresaBoa);
  console.log('✅ criar empresa válida');
  await devePassar('atualizar só o ativa', () => updateDoc(ref, { ativa: false }));
  await devePassar('atualizar o preço com inteiro', () =>
    updateDoc(ref, { precosPadrao: { ...precos, almoco: 2500 } }));

  // o que é inválido tem que ser bloqueado
  await deveFalhar('nome vazio', () => addDoc(empresas, { ...empresaBoa, nome: '' }));
  await deveFalhar('nome com 101 letras', () => addDoc(empresas, { ...empresaBoa, nome: 'a'.repeat(101) }));
  await deveFalhar('nome que não é texto', () => addDoc(empresas, { ...empresaBoa, nome: 123 }));
  await deveFalhar('preço quebrado (22.5)', () =>
    addDoc(empresas, { ...empresaBoa, precosPadrao: { ...precos, almoco: 22.5 } }));
  await deveFalhar('preço como texto', () =>
    addDoc(empresas, { ...empresaBoa, precosPadrao: { ...precos, almoco: '2200' } }));
  await deveFalhar('preço negativo', () =>
    addDoc(empresas, { ...empresaBoa, precosPadrao: { ...precos, almoco: -1 } }));
  await deveFalhar('faltando uma refeição', () =>
    addDoc(empresas, { ...empresaBoa, precosPadrao: { cafeManha: 850, almoco: 2200, cafeTarde: 850 } }));
  await deveFalhar('refeição a mais', () =>
    addDoc(empresas, { ...empresaBoa, precosPadrao: { ...precos, lanche: 500 } }));
  await deveFalhar('campo extra (admin)', () => addDoc(empresas, { ...empresaBoa, admin: true }));
  await deveFalhar('faltando o ativa', () => addDoc(empresas, { nome: 'X', precosPadrao: precos }));
  await deveFalhar('ativa como texto', () => addDoc(empresas, { ...empresaBoa, ativa: 'sim' }));
  await deveFalhar('editar e apagar o nome', () => updateDoc(ref, { nome: '' }));
  await deveFalhar('apagar empresa', () => deleteDoc(doc(db, 'empresas', ref.id)));
}