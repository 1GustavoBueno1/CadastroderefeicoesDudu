import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { entrar, sair } from '../services/auth';
import { criarEmpresa } from '../services/empresas';
import { buscarLancamento, salvarLancamento, listarLancamentosDoMes } from '../services/lancamentos';
import { montarItensDoDia, resumirMes } from '../lib/itens';
import { parseReais } from '../lib/dinheiro';
import type { Item, ItensDoDia } from '../types';

function confere(descricao: string, ok: boolean, detalhe?: unknown) {
  console.log(ok ? '✅' : '❌', descricao, detalhe ?? '');
}

async function lancaErro(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

function erroSincrono(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

// catálogo falso: montarItensDoDia só precisa da lista (não lê o banco)
const catalogo: Item[] = [
  { id: 'marmita', nome: 'Marmita', precoCentavos: 2200, ativo: true },
  { id: 'coca', nome: 'Coca lata', precoCentavos: 600, ativo: true },
  { id: 'agua', nome: 'Água', precoCentavos: 350, ativo: true },
];

export async function rodarTesteLancamentos() {
  await entrar('teste@teste.com', '123456'); // ajuste para o seu usuário do emulador

  const empresaId = await criarEmpresa({ nome: 'Teste Lançamentos', ativa: true });
  confere('criou empresa para o teste', !!empresaId, empresaId);

  // ---------- montarItensDoDia (sem banco) ----------
  const dia1 = montarItensDoDia({ marmita: 2, coca: 1, agua: 0 }, catalogo, null);
  confere('quantidade 0 não entra no dia', !('agua' in dia1), dia1);
  confere('item novo leva nome e preço do catálogo',
    dia1.marmita?.nome === 'Marmita' && dia1.marmita?.precoCentavos === 2200 && dia1.marmita?.quantidade === 2, dia1.marmita);

  // o preço da marmita mudou no catálogo depois do dia lançado
  const catalogoNovo = catalogo.map((i) => (i.id === 'marmita' ? { ...i, nome: 'Marmitex', precoCentavos: 2500 } : i));
  const dia1b = montarItensDoDia({ marmita: 3, coca: 1, agua: 2 }, catalogoNovo, dia1);
  confere('item já no dia mantém nome e preço gravados',
    dia1b.marmita?.nome === 'Marmita' && dia1b.marmita?.precoCentavos === 2200 && dia1b.marmita?.quantidade === 3, dia1b.marmita);
  confere('item novo no dia usa o preço atual', dia1b.agua?.precoCentavos === 350, dia1b.agua);
  const dia2 = montarItensDoDia({ marmita: 1 }, catalogoNovo, null);
  confere('dia novo usa o preço novo do catálogo', dia2.marmita?.precoCentavos === 2500 && dia2.marmita?.nome === 'Marmitex', dia2.marmita);
  confere('item fora do catálogo e fora do dia lança erro',
    erroSincrono(() => montarItensDoDia({ fantasma: 1 }, catalogo, null)) === 'Item desconhecido.');
  // item desativado/removido do catálogo, mas que já estava no dia, continua editável
  confere('item gravado que sumiu do catálogo continua no dia',
    montarItensDoDia({ marmita: 5 }, [], dia1).marmita?.quantidade === 5);

  // ---------- salvar ----------
  // 2×2200 + 1×600 = 5000
  await salvarLancamento(empresaId, '2026-10-05', dia1);
  const salvo = await buscarLancamento(empresaId, '2026-10-05');
  confere('totalCentavos === 5000', salvo?.totalCentavos === 5000, salvo?.totalCentavos);
  confere('buscar traz a data no campo data', salvo?.data === '2026-10-05', salvo?.data);

  // qtdFotos é de outro service: salvar de novo não pode apagar
  await updateDoc(doc(db, 'empresas', empresaId, 'lancamentos', '2026-10-05'), { qtdFotos: 2 });

  // tirar a coca do dia: ela tem que sumir do documento (sem merge do mapa)
  await salvarLancamento(empresaId, '2026-10-05', montarItensDoDia({ marmita: 2, coca: 0 }, catalogo, dia1));
  const semCoca = await buscarLancamento(empresaId, '2026-10-05');
  confere('item tirado do dia some do documento', semCoca !== null && !('coca' in semCoca.itens), semCoca?.itens);
  confere('salvar de novo recalculou o total', semCoca?.totalCentavos === 4400, semCoca?.totalCentavos);
  confere('salvar de novo preservou o qtdFotos', semCoca?.qtdFotos === 2, semCoca?.qtdFotos);

  // ---------- inválidos ----------
  const erroVazio = await lancaErro(() => salvarLancamento(empresaId, '2026-10-05', {}));
  confere('dia sem itens lança erro', erroVazio === 'Informe ao menos um item.', erroVazio);

  const com = (i: Partial<ItensDoDia[string]>): ItensDoDia => ({ marmita: { nome: 'Marmita', quantidade: 1, precoCentavos: 2200, ...i } });
  for (const invalido of [NaN, 2.5, -1, 0]) {
    const erroQtd = await lancaErro(() => salvarLancamento(empresaId, '2026-10-05', com({ quantidade: invalido })));
    confere(`quantidade ${invalido} lança erro`, erroQtd === 'Quantidade inválida.', erroQtd);
  }
  for (const invalido of [NaN, 2.5, -1]) {
    const erroPreco = await lancaErro(() => salvarLancamento(empresaId, '2026-10-05', com({ precoCentavos: invalido })));
    confere(`preço ${invalido} lança erro`, erroPreco === 'Preço inválido.', erroPreco);
  }
  const erroNome = await lancaErro(() => salvarLancamento(empresaId, '2026-10-05', com({ nome: '  ' })));
  confere('item sem nome lança erro', erroNome === 'Item sem nome.', erroNome);
  const depoisDosErros = await getDoc(doc(db, 'empresas', empresaId, 'lancamentos', '2026-10-05'));
  confere('valores inválidos não gravaram nada', depoisDosErros.data()?.totalCentavos === 4400, depoisDosErros.data());

  const erroData = await lancaErro(() => salvarLancamento(empresaId, '5/10/2026', dia1));
  confere('data fora do formato lança erro', erroData === 'Data inválida.', erroData);

  // ---------- listar do mês: só outubro, em ordem crescente ----------
  for (const data of ['2026-10-20', '2026-10-03', '2026-11-01', '2026-09-30']) {
    await salvarLancamento(empresaId, data, montarItensDoDia({ coca: 1 }, catalogo, null));
  }
  const outubro = await listarLancamentosDoMes(empresaId, '2026-10');
  const datas = outubro.map((l) => l.data);
  confere('listar outubro traz só outubro, em ordem',
    JSON.stringify(datas) === JSON.stringify(['2026-10-03', '2026-10-05', '2026-10-20']), datas);

  // ---------- resumo do mês por item ----------
  const resumo = resumirMes(outubro);
  const cocas = resumo.porItem.find((i) => i.itemId === 'coca');
  const marmitas = resumo.porItem.find((i) => i.itemId === 'marmita');
  confere('resumo soma a coca dos dias do mês', cocas?.quantidade === 2 && cocas?.valorCentavos === 1200, cocas);
  confere('resumo soma a marmita', marmitas?.quantidade === 2 && marmitas?.valorCentavos === 4400, marmitas);
  confere('resumo total do mês', resumo.totalCentavos === 5600, resumo.totalCentavos);
  // renomeado no meio do mês: uma linha só, com o nome do dia mais recente
  const renomeado = resumirMes([
    { data: '2026-10-01', itens: { coca: { nome: 'Coca', quantidade: 1, precoCentavos: 500 } }, totalCentavos: 500 },
    { data: '2026-10-09', itens: { coca: { nome: 'Coca lata', quantidade: 2, precoCentavos: 600 } }, totalCentavos: 1200 },
  ]);
  confere('item renomeado agrupa por id e usa o nome mais recente',
    renomeado.porItem.length === 1 && renomeado.porItem[0].nome === 'Coca lata' && renomeado.porItem[0].quantidade === 3
    && renomeado.porItem[0].valorCentavos === 1700, renomeado.porItem);

  const erroMes = await lancaErro(() => listarLancamentosDoMes(empresaId, '2026-1'));
  confere('mês fora do formato lança erro', erroMes === 'Mês inválido.', erroMes);

  // dia sem lançamento → null, não erro
  const inexistente = await buscarLancamento(empresaId, '2026-10-15');
  confere('dia inexistente devolve null', inexistente === null, inexistente);

  // dinheiro
  confere('parseReais("22,50") === 2250', parseReais('22,50') === 2250, parseReais('22,50'));
  confere('parseReais("1.234,56") === 123456', parseReais('1.234,56') === 123456, parseReais('1.234,56'));
  confere('parseReais("abc") === null', parseReais('abc') === null, parseReais('abc'));
  confere('parseReais("") === 0', parseReais('') === 0, parseReais(''));

  // regra: sem login não pode listar
  await sair();
  const erroSemLogin = await lancaErro(() => listarLancamentosDoMes(empresaId, '2026-10'));
  confere('sem login é bloqueado pela regra', erroSemLogin !== null, erroSemLogin ?? 'conseguiu listar sem login!');
}
