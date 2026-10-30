import { addDoc, collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { entrar, sair } from '../services/auth';

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

const itens = {
  marmita: { nome: 'Marmita', quantidade: 2, precoCentavos: 2200 },
  coca: { nome: 'Coca lata', quantidade: 1, precoCentavos: 600 },
};
const lancBom = { itens, totalCentavos: 5000 };

const PREFIXO = 'data:image/jpeg;base64,';
const fotoBoa = { dataUrl: PREFIXO + 'A'.repeat(100), ordem: 1 };

export async function rodarTesteRegrasFotos() {
  await entrar('teste@teste.com', '123456');
  console.log('--- regras de fotos ---');

  const empresa = await addDoc(collection(db, 'empresas'), {
    nome: 'Teste Regras Fotos', ativa: true,
  });
  const dia = doc(db, 'empresas', empresa.id, 'lancamentos', '2026-10-05');
  await setDoc(dia, lancBom);
  const fotos = collection(dia, 'fotos');
  const foto = (id: string) => doc(fotos, id);

  // ---------- o que é válido tem que passar ----------
  await devePassar('foto válida', () => setDoc(foto('boa'), fotoBoa));
  await devePassar('foto com ordem 0', () => setDoc(foto('ordem-zero'), { ...fotoBoa, ordem: 0 }));
  await devePassar('dataUrl com 999.999 caracteres (no limite)', () =>
    setDoc(foto('limite'), { dataUrl: PREFIXO + 'A'.repeat(999_999 - PREFIXO.length), ordem: 2 }));
  await devePassar('ler as fotos', () => getDocs(fotos));
  await devePassar('apagar foto', () => deleteDoc(foto('ordem-zero')));
  await devePassar('qtdFotos válido no lançamento', () => updateDoc(dia, { qtdFotos: 1 }));

  // ---------- dataUrl ----------
  await deveFalhar('PNG', () =>
    setDoc(foto('png'), { dataUrl: 'data:image/png;base64,' + 'A'.repeat(100), ordem: 1 }));
  await deveFalhar('texto que não é imagem', () =>
    setDoc(foto('texto'), { dataUrl: 'isto não é uma imagem', ordem: 1 }));
  await deveFalhar('prefixo JPEG no meio do texto', () =>
    setDoc(foto('meio'), { dataUrl: 'lixo ' + PREFIXO + 'AAAA', ordem: 1 }));
  await deveFalhar('dataUrl com 1.000.000 caracteres', () =>
    setDoc(foto('grande'), { dataUrl: PREFIXO + 'A'.repeat(1_000_000 - PREFIXO.length), ordem: 1 }));
  await deveFalhar('dataUrl como número', () => setDoc(foto('numero'), { dataUrl: 123, ordem: 1 }));

  // ---------- ordem ----------
  await deveFalhar('ordem negativa', () => setDoc(foto('neg'), { ...fotoBoa, ordem: -1 }));
  await deveFalhar('ordem como texto', () => setDoc(foto('txt'), { ...fotoBoa, ordem: '1' }));
  await deveFalhar('ordem quebrada (1.5)', () => setDoc(foto('quebrada'), { ...fotoBoa, ordem: 1.5 }));

  // ---------- campos ----------
  await deveFalhar('campo extra', () => setDoc(foto('extra'), { ...fotoBoa, legenda: 'oi' }));
  await deveFalhar('sem ordem', () => setDoc(foto('sem-ordem'), { dataUrl: fotoBoa.dataUrl }));
  await deveFalhar('sem dataUrl', () => setDoc(foto('sem-dataurl'), { ordem: 1 }));

  // ---------- update ----------
  await deveFalhar('update de foto (mesmo válido)', () => updateDoc(foto('boa'), { ordem: 5 }));
  await deveFalhar('sobrescrever foto existente com setDoc', () => setDoc(foto('boa'), { ...fotoBoa, ordem: 9 }));

  // ---------- contador no lançamento ----------
  await deveFalhar('qtdFotos -1 no lançamento', () => updateDoc(dia, { qtdFotos: -1 }));

  // ---------- sem login ----------
  await sair();
  await deveFalhar('criar foto sem login', () => setDoc(foto('anonima'), fotoBoa));
  await deveFalhar('ler fotos sem login', () => getDocs(fotos));
  await deveFalhar('apagar foto sem login', () => deleteDoc(foto('boa')));
}
