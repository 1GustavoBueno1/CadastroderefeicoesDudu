import { addDoc, collection, deleteDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { entrar, sair } from '../services/auth';

const itemBom = { nome: 'Teste Regras Item', precoCentavos: 600, ativo: true };
const itens = collection(db, 'itens');

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

export async function rodarTesteRegrasItens() {
  await entrar('teste@teste.com', '123456');
  console.log('--- regras de itens ---');

  // o que é válido tem que passar
  const ref = await addDoc(itens, itemBom);
  console.log('✅ criar item válido');
  await devePassar('ler itens', () => getDocs(itens));
  await devePassar('mudar o preço', () => updateDoc(ref, { precoCentavos: 650 }));
  await devePassar('desativar', () => updateDoc(ref, { ativo: false }));
  await devePassar('preço zero', () => updateDoc(ref, { precoCentavos: 0 }));

  // o que é inválido tem que ser bloqueado
  await deveFalhar('nome vazio', () => addDoc(itens, { ...itemBom, nome: '' }));
  await deveFalhar('nome com 101 letras', () => addDoc(itens, { ...itemBom, nome: 'a'.repeat(101) }));
  await deveFalhar('nome que não é texto', () => addDoc(itens, { ...itemBom, nome: 123 }));
  await deveFalhar('preço quebrado (6.5)', () => addDoc(itens, { ...itemBom, precoCentavos: 6.5 }));
  await deveFalhar('preço como texto', () => addDoc(itens, { ...itemBom, precoCentavos: '600' }));
  await deveFalhar('preço negativo', () => addDoc(itens, { ...itemBom, precoCentavos: -1 }));
  await deveFalhar('faltando o ativo', () => addDoc(itens, { nome: 'X', precoCentavos: 1 }));
  await deveFalhar('faltando o preço', () => addDoc(itens, { nome: 'X', ativo: true }));
  await deveFalhar('ativo como texto', () => addDoc(itens, { ...itemBom, ativo: 'sim' }));
  await deveFalhar('campo extra (empresaId)', () => addDoc(itens, { ...itemBom, empresaId: 'abc' }));
  await deveFalhar('editar e apagar o nome', () => updateDoc(ref, { nome: '' }));
  await deveFalhar('apagar item', () => deleteDoc(ref));

  // sem login
  await sair();
  await deveFalhar('ler sem login', () => getDocs(itens));
  await deveFalhar('criar sem login', () => addDoc(itens, itemBom));
}
