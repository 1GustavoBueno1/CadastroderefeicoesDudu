import {
  addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, Timestamp,
} from 'firebase/firestore';
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

const precos = { cafeManha: 850, almoco: 2200, cafeTarde: 900, janta: 2000 };
const quantidades = { cafeManha: 10, almoco: 25, cafeTarde: 8, janta: 12 };
const lancBom = { quantidades, precos, totalCentavos: 94700 };
const fotoBoa = { dataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(100), ordem: 1 };

export async function rodarTesteRegrasFechamento() {
  await entrar('teste@teste.com', '123456');
  console.log('--- regras de fechamento ---');

  const empresa = await addDoc(collection(db, 'empresas'), {
    nome: 'Teste Regras Fechamento', precosPadrao: precos, ativa: true,
  });
  const dia = (data: string) => doc(db, 'empresas', empresa.id, 'lancamentos', data);
  const foto = (data: string, id: string) => doc(dia(data), 'fotos', id);
  const fechamento = (mes: string) => doc(db, 'empresas', empresa.id, 'fechamentos', mes);
  const fechamentoBom = { totalCentavos: 94700, qtdNotas: 1, fechadoEm: serverTimestamp() };

  // preparação, com tudo aberto
  await setDoc(dia('2026-08-05'), { ...lancBom, qtdFotos: 1 });
  await setDoc(foto('2026-08-05', 'existente'), fotoBoa);
  await setDoc(dia('2026-09-05'), lancBom);

  // ---------- criar fechamento: o que é inválido não passa (antes do válido, que trava o mês) ----------
  await deveFalhar('fechadoEm do cliente (não serverTimestamp)', () =>
    setDoc(fechamento('2026-08'), { ...fechamentoBom, fechadoEm: Timestamp.now() }));
  await deveFalhar('fechadoEm como texto', () =>
    setDoc(fechamento('2026-08'), { ...fechamentoBom, fechadoEm: '2026-08-31' }));
  await deveFalhar('campo extra', () =>
    setDoc(fechamento('2026-08'), { ...fechamentoBom, reaberto: false }));
  await deveFalhar('sem qtdNotas', () =>
    setDoc(fechamento('2026-08'), { totalCentavos: 94700, fechadoEm: serverTimestamp() }));
  await deveFalhar('totalCentavos negativo', () =>
    setDoc(fechamento('2026-08'), { ...fechamentoBom, totalCentavos: -1 }));
  await deveFalhar('qtdNotas quebrado (1.5)', () =>
    setDoc(fechamento('2026-08'), { ...fechamentoBom, qtdNotas: 1.5 }));
  await deveFalhar('ID fora do formato AAAA-MM ("agosto")', () => setDoc(fechamento('agosto'), fechamentoBom));
  await deveFalhar('ID fora do formato AAAA-MM ("2026-8")', () => setDoc(fechamento('2026-8'), fechamentoBom));

  // ---------- fechamento válido ----------
  await devePassar('criar fechamento válido de agosto', () => setDoc(fechamento('2026-08'), fechamentoBom));
  await devePassar('ler fechamento', () => getDoc(fechamento('2026-08')));

  // ---------- agosto travado ----------
  await deveFalhar('agosto: editar lançamento', () => setDoc(dia('2026-08-05'), { ...lancBom, qtdFotos: 1, totalCentavos: 94700 }));
  await deveFalhar('agosto: criar lançamento novo', () => setDoc(dia('2026-08-06'), lancBom));
  await deveFalhar('agosto: mudar só qtdFotos', () => updateDoc(dia('2026-08-05'), { qtdFotos: 0 }));
  await deveFalhar('agosto: apagar lançamento', () => deleteDoc(dia('2026-08-05')));
  await deveFalhar('agosto: criar foto', () => setDoc(foto('2026-08-05', 'nova'), fotoBoa));
  await deveFalhar('agosto: apagar foto', () => deleteDoc(foto('2026-08-05', 'existente')));
  await devePassar('agosto: ler o lançamento continua liberado', () => getDoc(dia('2026-08-05')));

  // ---------- meses vizinhos abertos ----------
  await devePassar('setembro: editar lançamento', () => setDoc(dia('2026-09-05'), lancBom));
  await devePassar('setembro: criar foto', () => setDoc(foto('2026-09-05', 'set'), fotoBoa));
  await devePassar('setembro: apagar foto', () => deleteDoc(foto('2026-09-05', 'set')));
  await devePassar('julho: criar lançamento', () => setDoc(dia('2026-07-31'), lancBom));
  await devePassar('julho: apagar lançamento', () => deleteDoc(dia('2026-07-31')));
  await devePassar('agosto de 2025 (mesmo mês, outro ano): criar lançamento', () => setDoc(dia('2025-08-05'), lancBom));

  // ---------- fechamento não muda nem some ----------
  await deveFalhar('update do fechamento', () => updateDoc(fechamento('2026-08'), { totalCentavos: 1 }));
  await deveFalhar('sobrescrever fechamento com setDoc', () => setDoc(fechamento('2026-08'), fechamentoBom));
  await deveFalhar('delete do fechamento (reabrir)', () => deleteDoc(fechamento('2026-08')));

  // ---------- sem login ----------
  await sair();
  await deveFalhar('ler fechamento sem login', () => getDoc(fechamento('2026-08')));
  await deveFalhar('criar fechamento sem login', () => setDoc(fechamento('2026-10'), fechamentoBom));
}
