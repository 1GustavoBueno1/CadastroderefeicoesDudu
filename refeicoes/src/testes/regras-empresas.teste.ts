import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { entrar } from '../services/auth';

const empresaBoa = { nome: 'Teste Regras', ativa: true };
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
  await devePassar('renomear', () => updateDoc(ref, { nome: 'Outro nome' }));

  // o que é inválido tem que ser bloqueado
  await deveFalhar('nome vazio', () => addDoc(empresas, { ...empresaBoa, nome: '' }));
  await deveFalhar('nome com 101 letras', () => addDoc(empresas, { ...empresaBoa, nome: 'a'.repeat(101) }));
  await deveFalhar('nome que não é texto', () => addDoc(empresas, { ...empresaBoa, nome: 123 }));
  await deveFalhar('precosPadrao (modelo antigo) é campo extra', () =>
    addDoc(empresas, { ...empresaBoa, precosPadrao: { almoco: 2200 } }));
  await deveFalhar('campo extra (admin)', () => addDoc(empresas, { ...empresaBoa, admin: true }));
  await deveFalhar('faltando o ativa', () => addDoc(empresas, { nome: 'X' }));
  await deveFalhar('ativa como texto', () => addDoc(empresas, { ...empresaBoa, ativa: 'sim' }));
  await deveFalhar('editar e apagar o nome', () => updateDoc(ref, { nome: '' }));
  await deveFalhar('apagar empresa', () => deleteDoc(doc(db, 'empresas', ref.id)));
}
