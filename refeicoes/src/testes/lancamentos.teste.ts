import { entrar, sair } from '../services/auth';
import { criarEmpresa } from '../services/empresas';
import { buscarLancamento, salvarLancamento, listarLancamentosDoMes } from '../services/lancamentos';
import { parseReais } from '../lib/dinheiro';
import type { PorRefeicao } from '../types';

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

export async function rodarTesteLancamentos() {
  await entrar('teste@teste.com', '123456'); // ajuste para o seu usuário do emulador

  const precos: PorRefeicao = { cafeManha: 850, almoco: 2200, cafeTarde: 850, janta: 2000 };
  const quantidades: PorRefeicao = { cafeManha: 10, almoco: 25, cafeTarde: 8, janta: 12 };

  const empresaId = await criarEmpresa({ nome: 'Teste Lançamentos', precosPadrao: precos, ativa: true });
  confere('criou empresa para o teste', !!empresaId, empresaId);

  // salvar e conferir o total: 10*850 + 25*2200 + 8*850 + 12*2000 = 94300 (o roteiro dizia 100300, mas a conta dá 94300)
  await salvarLancamento(empresaId, '2026-10-05', quantidades, precos);
  const dia5 = await buscarLancamento(empresaId, '2026-10-05');
  confere('totalCentavos === 94300', dia5?.totalCentavos === 94300, dia5?.totalCentavos);
  confere('buscar traz a data no campo data', dia5?.data === '2026-10-05', dia5?.data);

  // salvar o mesmo dia de novo → atualiza
  await salvarLancamento(empresaId, '2026-10-05', { ...quantidades, almoco: 30 }, precos);
  const dia5b = await buscarLancamento(empresaId, '2026-10-05');
  confere('salvar de novo atualizou a quantidade', dia5b?.quantidades.almoco === 30, dia5b?.quantidades);
  confere('salvar de novo recalculou o total', dia5b?.totalCentavos === 105300, dia5b?.totalCentavos);

  // valores inválidos lançam erro e não gravam
  for (const invalido of [NaN, 2.5, -1]) {
    const erroQtd = await lancaErro(() =>
      salvarLancamento(empresaId, '2026-10-05', { ...quantidades, almoco: invalido }, precos));
    confere(`quantidade ${invalido} lança erro`, erroQtd === 'Quantidade inválida.', erroQtd);

    const erroPreco = await lancaErro(() =>
      salvarLancamento(empresaId, '2026-10-05', quantidades, { ...precos, janta: invalido }));
    confere(`preço ${invalido} lança erro`, erroPreco === 'Preço inválido.', erroPreco);
  }
  const dia5c = await buscarLancamento(empresaId, '2026-10-05');
  confere('valores inválidos não gravaram nada',
    dia5c?.quantidades.almoco === 30 && dia5c?.precos.janta === 2000 && dia5c?.totalCentavos === 105300,
    dia5c);

  const erroData = await lancaErro(() => salvarLancamento(empresaId, '5/10/2026', quantidades, precos));
  confere('data fora do formato lança erro', erroData === 'Data inválida.', erroData);

  // listar do mês: só outubro, em ordem crescente
  for (const data of ['2026-10-20', '2026-10-03', '2026-11-01', '2026-09-30']) {
    await salvarLancamento(empresaId, data, quantidades, precos);
  }
  const outubro = await listarLancamentosDoMes(empresaId, '2026-10');
  const datas = outubro.map((l) => l.data);
  confere('listar outubro traz só outubro, em ordem',
    JSON.stringify(datas) === JSON.stringify(['2026-10-03', '2026-10-05', '2026-10-20']), datas);

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
