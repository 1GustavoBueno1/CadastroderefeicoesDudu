import { entrar, sair } from '../services/auth';
import { criarEmpresa } from '../services/empresas';
import { buscarLancamento, excluirLancamento, salvarLancamento } from '../services/lancamentos';
import { adicionarFotos, listarFotos, removerFoto } from '../services/fotos';
import type { ItensDoDia } from '../types';

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

// imagem de teste desenhada na hora: um retângulo colorido com um número, sem arquivo externo
function imagemDeTeste(cor: string, texto: string): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 80;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = '32px sans-serif';
  ctx.fillText(texto, 48, 52);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('canvas.toBlob devolveu null'));
      resolve(new File([blob], `nota-${texto}.png`, { type: 'image/png' }));
    }, 'image/png');
  });
}

export async function rodarTesteFotos() {
  await entrar('teste@teste.com', '123456'); // ajuste para o seu usuário do emulador
  console.log('--- fotos (service) ---');

  const itens: ItensDoDia = {
    marmita: { nome: 'Marmita', quantidade: 25, precoCentavos: 2200 },
    coca: { nome: 'Coca lata', quantidade: 10, precoCentavos: 600 },
  };
  const empresaId = await criarEmpresa({ nome: 'Teste Fotos', ativa: true });
  const data = '2026-10-05';
  await salvarLancamento(empresaId, data, itens);

  // adicionar 2 fotos
  await adicionarFotos(empresaId, data, [await imagemDeTeste('#b8336a', '1'), await imagemDeTeste('#247b50', '2')]);
  let lanc = await buscarLancamento(empresaId, data);
  confere('depois de adicionar 2: qtdFotos === 2', lanc?.qtdFotos === 2, lanc?.qtdFotos);
  let fotos = await listarFotos(empresaId, data);
  confere('listarFotos traz 2', fotos.length === 2, fotos.length);
  confere('fotos em ordem crescente', fotos.length === 2 && fotos[0].ordem < fotos[1].ordem, fotos.map((f) => f.ordem));
  confere('fotos gravadas como JPEG', fotos.every((f) => f.dataUrl.startsWith('data:image/jpeg;base64,')));

  // salvar o lançamento de novo não pode apagar o contador
  await salvarLancamento(empresaId, data, { ...itens, marmita: { ...itens.marmita, quantidade: 30 } });
  lanc = await buscarLancamento(empresaId, data);
  confere('salvar o dia de novo mantém qtdFotos === 2', lanc?.qtdFotos === 2, lanc?.qtdFotos);

  // mais uma foto continua a ordem
  await adicionarFotos(empresaId, data, [await imagemDeTeste('#1a1216', '3')]);
  fotos = await listarFotos(empresaId, data);
  confere('3ª foto vem depois das outras', fotos.length === 3 && fotos[2].ordem > fotos[1].ordem, fotos.map((f) => f.ordem));

  // remover 1
  await removerFoto(empresaId, data, fotos[0].id);
  lanc = await buscarLancamento(empresaId, data);
  confere('depois de remover 1: qtdFotos === 2', lanc?.qtdFotos === 2, lanc?.qtdFotos);
  // remover a mesma de novo (clique duplo) não desconta outra vez
  await removerFoto(empresaId, data, fotos[0].id);
  lanc = await buscarLancamento(empresaId, data);
  confere('remover a mesma foto 2 vezes não desconta de novo', lanc?.qtdFotos === 2, lanc?.qtdFotos);
  fotos = await listarFotos(empresaId, data);
  confere('listarFotos bate com qtdFotos', fotos.length === lanc?.qtdFotos, fotos.length);

  // dia sem lançamento
  const erroSemLanc = await lancaErro(async () =>
    adicionarFotos(empresaId, '2026-10-06', [await imagemDeTeste('#5f565a', 'x')]));
  confere('adicionar em dia sem lançamento lança erro',
    erroSemLanc === 'Salve o lançamento do dia antes de adicionar notas.', erroSemLanc);
  const fotosDiaVazio = await listarFotos(empresaId, '2026-10-06');
  confere('e não gravou foto nenhuma', fotosDiaVazio.length === 0, fotosDiaVazio.length);

  // excluir o dia
  await excluirLancamento(empresaId, data);
  const lancExcluido = await buscarLancamento(empresaId, data);
  confere('excluirLancamento apagou o lançamento', lancExcluido === null, lancExcluido);
  const fotosExcluidas = await listarFotos(empresaId, data);
  confere('excluirLancamento apagou as fotos', fotosExcluidas.length === 0, fotosExcluidas.length);

  await sair();
}
