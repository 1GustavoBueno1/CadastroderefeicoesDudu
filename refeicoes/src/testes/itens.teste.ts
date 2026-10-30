import { entrar, sair } from '../services/auth';
import { atualizarItem, criarItem, definirAtivo, listarItens } from '../services/itens';
import { normalizar } from '../lib/itens';

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

export async function rodarTesteItens() {
  await entrar('teste@teste.com', '123456'); // ajuste para o seu usuário do emulador
  // nomes únicos por execução: o catálogo é um só e os testes não apagam nada
  const sufixo = Date.now().toString(36);
  const coca = `Coca lata ${sufixo}`;

  confere('normalizar ignora acento, maiúscula e espaços', normalizar('  Coca   LÁTA ') === 'coca lata', normalizar('  Coca   LÁTA '));

  // criar (com espaços de propósito, para testar o trim)
  const idCoca = await criarItem({ nome: `  ${coca}  `, precoCentavos: 600 });
  const idZeta = await criarItem({ nome: `Zeta ${sufixo}`, precoCentavos: 100 });
  const idAgua = await criarItem({ nome: `Água ${sufixo}`, precoCentavos: 350 });
  let itens = await listarItens();
  const salvo = itens.find((i) => i.id === idCoca);
  confere('criarItem grava nome sem espaços, preço e ativo', salvo?.nome === coca && salvo?.precoCentavos === 600 && salvo?.ativo === true, salvo);
  const nomes = itens.map((i) => i.id);
  confere('listar ordena por nome (Água antes de Coca antes de Zeta)',
    nomes.indexOf(idAgua) < nomes.indexOf(idCoca) && nomes.indexOf(idCoca) < nomes.indexOf(idZeta), itens.map((i) => i.nome));

  // validações
  confere('nome vazio recusado', await lancaErro(() => criarItem({ nome: '   ', precoCentavos: 100 })) === 'Informe o nome do item.');
  confere('nome com 101 letras recusado',
    await lancaErro(() => criarItem({ nome: 'a'.repeat(101), precoCentavos: 100 })) === 'Use no máximo 100 caracteres.');
  for (const invalido of [NaN, 2.5, -1]) {
    const erro = await lancaErro(() => criarItem({ nome: `Preço ${invalido} ${sufixo}`, precoCentavos: invalido }));
    confere(`preço ${invalido} recusado`, erro === 'Preço inválido.', erro);
  }

  // duplicado: sem diferenciar maiúscula e acento
  const erroDup = await lancaErro(() => criarItem({ nome: `COCA LÁTA ${sufixo}`, precoCentavos: 700 }));
  confere('nome duplicado (maiúscula/acento) recusado', erroDup === 'Já existe um item ativo com esse nome.', erroDup);
  const erroRenomear = await lancaErro(() => atualizarItem(idZeta, { nome: coca, precoCentavos: 100 }));
  confere('renomear para nome de outro item ativo recusado', erroRenomear === 'Já existe um item ativo com esse nome.', erroRenomear);

  // editar
  await atualizarItem(idCoca, { nome: coca, precoCentavos: 650 });
  itens = await listarItens();
  confere('editar o preço (mesmo nome) funciona', itens.find((i) => i.id === idCoca)?.precoCentavos === 650);

  // desativar libera o nome; reativar o antigo esbarra no novo
  await definirAtivo(idCoca, false);
  itens = await listarItens();
  confere('desativar marca ativo = false', itens.find((i) => i.id === idCoca)?.ativo === false);
  const idCoca2 = await criarItem({ nome: coca, precoCentavos: 700 });
  confere('com o antigo desativado, o nome pode ser usado de novo', !!idCoca2);
  const erroReativar = await lancaErro(() => definirAtivo(idCoca, true));
  confere('reativar com nome já usado por item ativo é recusado', erroReativar === 'Já existe um item ativo com esse nome.', erroReativar);
  await definirAtivo(idCoca2, false);
  await definirAtivo(idCoca, true);
  itens = await listarItens();
  confere('reativar com o nome livre funciona', itens.find((i) => i.id === idCoca)?.ativo === true);

  confere('editar item inexistente lança erro',
    await lancaErro(() => atualizarItem('id-que-nao-existe', { nome: 'X', precoCentavos: 1 })) === 'Item não encontrado.');

  // regra: sem login não pode listar
  await sair();
  const erroSemLogin = await lancaErro(() => listarItens());
  confere('sem login é bloqueado pela regra', erroSemLogin !== null, erroSemLogin ?? 'conseguiu listar sem login!');
}
