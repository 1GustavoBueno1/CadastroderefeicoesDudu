import { addDoc, collection, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
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

// As regras só conferem a estrutura: a soma do total e cada item do mapa ficam no service
// (as regras não têm laço). Por isso não há mais teste de "total maquiado" aqui.
const itens = {
  marmita: { nome: 'Marmita', quantidade: 2, precoCentavos: 2200 },
  coca: { nome: 'Coca lata', quantidade: 1, precoCentavos: 600 },
};
const lancBom = { itens, totalCentavos: 5000 };

export async function rodarTesteRegrasLancamentos() {
  await entrar('teste@teste.com', '123456');
  console.log('--- regras de lançamentos ---');

  const empresa = await addDoc(collection(db, 'empresas'), { nome: 'Teste Lançamentos', ativa: true });
  const dia = (data: string) => doc(db, 'empresas', empresa.id, 'lancamentos', data);

  // ---------- o que é válido tem que passar ----------
  await devePassar('criar lançamento válido', () => setDoc(dia('2026-10-05'), lancBom));
  await devePassar('trocar o mapa de itens (updateDoc)', () =>
    updateDoc(dia('2026-10-05'), { itens: { coca: itens.coca }, totalCentavos: 600 }));
  await devePassar('qtdFotos válido (merge)', () =>
    setDoc(dia('2026-10-05'), { qtdFotos: 2 }, { merge: true }));
  await devePassar('salvar itens com qtdFotos já no documento', () =>
    updateDoc(dia('2026-10-05'), { itens, totalCentavos: 5000 }));
  await devePassar('excluir lançamento', async () => {
    await setDoc(dia('2026-10-06'), lancBom);
    await deleteDoc(dia('2026-10-06'));
  });

  // ---------- data (ID) inválida ----------
  await deveFalhar('ID "banana"', () => setDoc(dia('banana'), lancBom));
  await deveFalhar('ID sem zero no dia (2026-10-5)', () => setDoc(dia('2026-10-5'), lancBom));
  await deveFalhar('ID com lixo no fim', () => setDoc(dia('2026-10-05x'), lancBom));

  // ---------- estrutura ----------
  await deveFalhar('mapa de itens vazio', () => setDoc(dia('2026-10-07'), { itens: {}, totalCentavos: 0 }));
  await deveFalhar('itens como lista', () => setDoc(dia('2026-10-07'), { itens: [itens.coca], totalCentavos: 600 }));
  await deveFalhar('sem itens', () => setDoc(dia('2026-10-07'), { totalCentavos: 600 }));
  await deveFalhar('sem totalCentavos', () => setDoc(dia('2026-10-07'), { itens }));
  await deveFalhar('total como texto', () => setDoc(dia('2026-10-07'), { itens, totalCentavos: '5000' }));
  await deveFalhar('total quebrado (50.5)', () => setDoc(dia('2026-10-07'), { itens, totalCentavos: 50.5 }));
  await deveFalhar('total negativo', () => setDoc(dia('2026-10-07'), { itens, totalCentavos: -1 }));
  await deveFalhar('modelo antigo (quantidades/precos)', () =>
    setDoc(dia('2026-10-07'), { quantidades: { almoco: 1 }, precos: { almoco: 2200 }, totalCentavos: 2200 }));

  // ---------- campos ----------
  await deveFalhar('campo extra', () => setDoc(dia('2026-10-07'), { ...lancBom, aprovado: true }));
  await deveFalhar('qtdFotos negativo', () => setDoc(dia('2026-10-07'), { ...lancBom, qtdFotos: -1 }));
  await deveFalhar('qtdFotos como texto', () => setDoc(dia('2026-10-07'), { ...lancBom, qtdFotos: 'dois' }));

  // ---------- a brecha dos parênteses ----------
  await deveFalhar('qtdFotos válido + total lixo (brecha do ||)', () =>
    setDoc(dia('2026-10-07'), { ...lancBom, qtdFotos: 1, totalCentavos: 'banana' }));
  await deveFalhar('qtdFotos válido + itens vazio (brecha do ||)', () =>
    setDoc(dia('2026-10-07'), { itens: {}, totalCentavos: 0, qtdFotos: 1 }));

  // ---------- sem login ----------
  await sair();
  await deveFalhar('ler sem login', () => getDoc(dia('2026-10-05')));
  await deveFalhar('apagar sem login', () => deleteDoc(dia('2026-10-05')));
}
