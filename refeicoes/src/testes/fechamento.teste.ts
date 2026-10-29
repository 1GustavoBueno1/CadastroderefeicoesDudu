import { entrar, sair } from '../services/auth';
import { criarEmpresa } from '../services/empresas';
import { buscarLancamento, excluirLancamento, salvarLancamento } from '../services/lancamentos';
import { adicionarFotos, listarFotos, removerFoto } from '../services/fotos';
import { apagarNotasDoMes, buscarFechamento } from '../services/fechamentos';
import { calcularTotal, type PorRefeicao } from '../types';

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

// imagem de teste desenhada na hora, sem arquivo externo
function imagemDeTeste(cor: string): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 80;
  canvas.height = 60;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('canvas.toBlob devolveu null'));
      resolve(new File([blob], 'nota.png', { type: 'image/png' }));
    }, 'image/png');
  });
}

const MES_FECHADO = 'Mês fechado. Não é possível editar.';

export async function rodarTesteFechamento() {
  await entrar('teste@teste.com', '123456'); // ajuste para o seu usuário do emulador
  console.log('--- fechamento do mês (service) ---');

  const precos: PorRefeicao = { cafeManha: 850, almoco: 2200, cafeTarde: 900, janta: 2000 };
  const q1: PorRefeicao = { cafeManha: 10, almoco: 25, cafeTarde: 8, janta: 12 };
  const q2: PorRefeicao = { cafeManha: 4, almoco: 30, cafeTarde: 0, janta: 7 };
  const empresaId = await criarEmpresa({ nome: 'Teste Fechamento', precosPadrao: precos, ativa: true });

  // agosto: 2 dias, 3 notas no total; setembro: 1 dia com 1 nota
  await salvarLancamento(empresaId, '2026-08-05', q1, precos);
  await salvarLancamento(empresaId, '2026-08-20', q2, precos);
  await salvarLancamento(empresaId, '2026-09-01', q1, precos);
  await adicionarFotos(empresaId, '2026-08-05', [await imagemDeTeste('#b8336a'), await imagemDeTeste('#247b50')]);
  await adicionarFotos(empresaId, '2026-08-20', [await imagemDeTeste('#1a1216')]);
  await adicionarFotos(empresaId, '2026-09-01', [await imagemDeTeste('#5f565a')]);
  const fotoAgosto = (await listarFotos(empresaId, '2026-08-05'))[0];
  const totalAgosto = calcularTotal(q1, precos) + calcularTotal(q2, precos);

  confere('antes: agosto não está fechado', (await buscarFechamento(empresaId, '2026-08')) === null);

  // fechar agosto
  await apagarNotasDoMes(empresaId, '2026-08');

  const fotos5 = await listarFotos(empresaId, '2026-08-05');
  const fotos20 = await listarFotos(empresaId, '2026-08-20');
  confere('apagou as fotos de agosto', fotos5.length === 0 && fotos20.length === 0, [fotos5.length, fotos20.length]);
  const l5 = await buscarLancamento(empresaId, '2026-08-05');
  const l20 = await buscarLancamento(empresaId, '2026-08-20');
  confere('zerou qtdFotos dos dias de agosto', l5?.qtdFotos === 0 && l20?.qtdFotos === 0, [l5?.qtdFotos, l20?.qtdFotos]);
  confere('manteve os lançamentos de agosto', l5?.totalCentavos === calcularTotal(q1, precos) && !!l20);

  const fechamento = await buscarFechamento(empresaId, '2026-08');
  confere('criou o fechamento', fechamento !== null, fechamento);
  confere('fechamento.totalCentavos === soma dos dias', fechamento?.totalCentavos === totalAgosto,
    `${fechamento?.totalCentavos} / esperado ${totalAgosto}`);
  confere('fechamento.qtdNotas === 3', fechamento?.qtdNotas === 3, fechamento?.qtdNotas);
  confere('fechadoEm chega como Date', fechamento?.fechadoEm instanceof Date, fechamento?.fechadoEm);
  confere('fechamento.mes === "2026-08"', fechamento?.mes === '2026-08', fechamento?.mes);

  // setembro não foi tocado
  const fotosSetembro = await listarFotos(empresaId, '2026-09-01');
  confere('setembro manteve a nota', fotosSetembro.length === 1, fotosSetembro.length);

  // trava: tudo em agosto lança 'Mês fechado...'
  const erroSalvar = await lancaErro(() => salvarLancamento(empresaId, '2026-08-05', q2, precos));
  confere('salvar dia de agosto lança "Mês fechado"', erroSalvar === MES_FECHADO, erroSalvar);
  const erroNovo = await lancaErro(() => salvarLancamento(empresaId, '2026-08-25', q2, precos));
  confere('lançar dia NOVO em agosto lança "Mês fechado"', erroNovo === MES_FECHADO, erroNovo);
  const erroAdicionar = await lancaErro(async () => adicionarFotos(empresaId, '2026-08-05', [await imagemDeTeste('#000000')]));
  confere('adicionar foto em agosto lança "Mês fechado"', erroAdicionar === MES_FECHADO, erroAdicionar);
  const erroRemover = await lancaErro(() => removerFoto(empresaId, '2026-08-05', fotoAgosto.id));
  confere('remover foto em agosto lança "Mês fechado"', erroRemover === MES_FECHADO, erroRemover);
  const erroExcluir = await lancaErro(() => excluirLancamento(empresaId, '2026-08-20'));
  confere('excluir dia de agosto lança "Mês fechado"', erroExcluir === MES_FECHADO, erroExcluir);
  const l20depois = await buscarLancamento(empresaId, '2026-08-20');
  confere('e o dia de agosto continua lá, igual', l20depois?.totalCentavos === calcularTotal(q2, precos));

  // outro mês continua editável
  const erroSetembro = await lancaErro(() => salvarLancamento(empresaId, '2026-09-01', q2, precos));
  confere('setembro: salvar continua funcionando', erroSetembro === null, erroSetembro);
  const erroFotoSetembro = await lancaErro(async () => adicionarFotos(empresaId, '2026-09-01', [await imagemDeTeste('#cccccc')]));
  confere('setembro: adicionar foto continua funcionando', erroFotoSetembro === null, erroFotoSetembro);
  const erroJulho = await lancaErro(() => salvarLancamento(empresaId, '2026-07-31', q1, precos));
  confere('julho (vizinho) continua editável', erroJulho === null, erroJulho);
  const erroExcluirSetembro = await lancaErro(() => excluirLancamento(empresaId, '2026-09-01'));
  confere('setembro: excluir dia continua funcionando', erroExcluirSetembro === null, erroExcluirSetembro);

  // fechar de novo
  const erroDeNovo = await lancaErro(() => apagarNotasDoMes(empresaId, '2026-08'));
  confere('apagar notas de novo lança "já foi fechado"', erroDeNovo === 'Este mês já foi fechado.', erroDeNovo);

  await sair();
}
