import { addDoc, collection, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
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

// preços DIFERENTES em cada refeição, para pegar troca de campo na conta
const precos = { cafeManha: 850, almoco: 2200, cafeTarde: 900, janta: 2000 };
const quantidades = { cafeManha: 10, almoco: 25, cafeTarde: 8, janta: 12 };
// 10×850 + 25×2200 + 8×900 + 12×2000 = 8500 + 55000 + 7200 + 24000
const totalCerto = 94700;
const lancBom = { quantidades, precos, totalCentavos: totalCerto };

export async function rodarTesteRegrasLancamentos() {
  await entrar('teste@teste.com', '123456');
  console.log('--- regras de lançamentos ---');

  const empresa = await addDoc(collection(db, 'empresas'), {
    nome: 'Teste Lançamentos', precosPadrao: precos, ativa: true,
  });
  const dia = (data: string) => doc(db, 'empresas', empresa.id, 'lancamentos', data);

  // ---------- o que é válido tem que passar ----------
  await devePassar('criar lançamento válido', () => setDoc(dia('2026-10-05'), lancBom));
  await devePassar('editar quantidades com total certo', () =>
    setDoc(dia('2026-10-05'), {
      quantidades: { ...quantidades, almoco: 30 },
      precos,
      totalCentavos: totalCerto + 5 * 2200,
    }));
  await devePassar('qtdFotos válido (merge)', () =>
    setDoc(dia('2026-10-05'), { qtdFotos: 2 }, { merge: true }));
  await devePassar('tudo zerado', () =>
    setDoc(dia('2026-10-06'), {
      quantidades: { cafeManha: 0, almoco: 0, cafeTarde: 0, janta: 0 },
      precos,
      totalCentavos: 0,
    }));
  await devePassar('excluir lançamento', () => deleteDoc(dia('2026-10-06')));

  // ---------- data (ID) inválida ----------
  await deveFalhar('ID "banana"', () => setDoc(dia('banana'), lancBom));
  await deveFalhar('ID sem zero no dia (2026-10-5)', () => setDoc(dia('2026-10-5'), lancBom));
  await deveFalhar('ID com lixo no fim', () => setDoc(dia('2026-10-05x'), lancBom));

  // ---------- total ----------
  await deveFalhar('total maquiado (+1 centavo)', () =>
    setDoc(dia('2026-10-07'), { ...lancBom, totalCentavos: totalCerto + 1 }));
  await deveFalhar('total calculado com o preço do café trocado', () =>
    setDoc(dia('2026-10-07'), { ...lancBom, totalCentavos: 10 * 850 + 25 * 2200 + 8 * 850 + 12 * 2000 }));
  await deveFalhar('total como texto', () =>
    setDoc(dia('2026-10-07'), { ...lancBom, totalCentavos: '94700' }));
  await deveFalhar('sem totalCentavos', () =>
    setDoc(dia('2026-10-07'), { quantidades, precos }));

  // ---------- quantidades e preços ----------
  await deveFalhar('quantidade como texto', () =>
    setDoc(dia('2026-10-07'), { ...lancBom, quantidades: { ...quantidades, almoco: '25' } }));
  await deveFalhar('quantidade quebrada (2.5)', () =>
    setDoc(dia('2026-10-07'), { ...lancBom, quantidades: { ...quantidades, cafeManha: 2.5 } }));
  await deveFalhar('quantidade negativa', () =>
    setDoc(dia('2026-10-07'), { ...lancBom, quantidades: { ...quantidades, janta: -1 } }));
  await deveFalhar('faltando a janta', () =>
    setDoc(dia('2026-10-07'), {
      ...lancBom, quantidades: { cafeManha: 10, almoco: 25, cafeTarde: 8 },
    }));
  await deveFalhar('preço negativo', () =>
    setDoc(dia('2026-10-07'), { ...lancBom, precos: { ...precos, almoco: -2200 } }));

  // ---------- campos ----------
  await deveFalhar('campo extra', () =>
    setDoc(dia('2026-10-07'), { ...lancBom, aprovado: true }));
  await deveFalhar('qtdFotos negativo', () =>
    setDoc(dia('2026-10-07'), { ...lancBom, qtdFotos: -1 }));
  await deveFalhar('qtdFotos como texto', () =>
    setDoc(dia('2026-10-07'), { ...lancBom, qtdFotos: 'dois' }));

  // ---------- a brecha dos parênteses ----------
  await deveFalhar('qtdFotos válido + total maquiado (brecha do ||)', () =>
    setDoc(dia('2026-10-07'), { ...lancBom, qtdFotos: 1, totalCentavos: 1 }));
  await deveFalhar('qtdFotos válido + quantidade lixo (brecha do ||)', () =>
    setDoc(dia('2026-10-07'), {
      ...lancBom, qtdFotos: 1, quantidades: { ...quantidades, almoco: 'banana' },
    }));

  // ---------- sem login ----------
  await sair();
  await deveFalhar('ler sem login', () => getDoc(dia('2026-10-05')));
  await deveFalhar('apagar sem login', () => deleteDoc(dia('2026-10-05')));
}