import { entrar, sair } from '../services/auth';
import {
  listarEmpresas,
  buscarEmpresa,
  criarEmpresa,
  atualizarEmpresa,
} from '../services/empresas';

function confere(descricao: string, ok: boolean, detalhe?: unknown) {
  console.log(ok ? '✅' : '❌', descricao, detalhe ?? '');
}

export async function rodarTesteEmpresas() {
  await entrar('teste@teste.com', '123456'); // ajuste para o seu usuário do emulador

  // criar (com espaços de propósito, para testar o trim)
  const idZeta = await criarEmpresa({ nome: '  Zeta  ', ativa: true });
  const idAlfa = await criarEmpresa({ nome: '  Alfa  ', ativa: true });
  confere('criarEmpresa devolve IDs', !!idZeta && !!idAlfa, { idZeta, idAlfa });

  // buscar e conferir o trim
  const alfa = await buscarEmpresa(idAlfa);
  confere('nome salvo sem espaços', alfa?.nome === 'Alfa', `"${alfa?.nome}"`);
  confere('buscarEmpresa traz o id', alfa?.id === idAlfa);
  confere('empresa não tem mais preços', alfa !== null && !('precosPadrao' in alfa), alfa);

  // listar e conferir a ordem
  const lista = await listarEmpresas();
  const nomes = lista.map((e) => e.nome);
  const posAlfa = nomes.indexOf('Alfa');
  const posZeta = nomes.indexOf('Zeta');
  confere('listar ordena por nome (Alfa antes de Zeta)', posAlfa !== -1 && posAlfa < posZeta, nomes);

  // atualizar só um campo
  await atualizarEmpresa(idAlfa, { ativa: false });
  const alfaDepois = await buscarEmpresa(idAlfa);
  confere('atualizar mudou o ativa', alfaDepois?.ativa === false);
  confere('atualizar não mexeu no nome', alfaDepois?.nome === 'Alfa');

  // ID que não existe → null, não erro
  const inexistente = await buscarEmpresa('id-que-nao-existe');
  confere('buscar inexistente devolve null', inexistente === null, inexistente);

  // regra: sem login não pode listar
  await sair();
  try {
    await listarEmpresas();
    confere('sem login é bloqueado pela regra', false, 'conseguiu listar sem login!');
  } catch (e) {
    confere('sem login é bloqueado pela regra', true, (e as Error).message);
  }
}
