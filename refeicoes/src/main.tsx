import { auth } from './firebase';
import { entrar, sair, verificarAcesso, observarSessao } from './services/auth'
async function teste() {
  observarSessao((usuario) => console.log('sessão:', usuario?.email ?? 'ninguém'));

  // 1. senha errada → deve cair no catch com a SUA mensagem
  try {
    await entrar('teste@teste.com', 'senhaerrada');
  } catch (e) {
    console.log('1 (esperado erro):', (e as Error).message);
  }

  // 2. login certo
  await entrar('teste@teste.com', '123456');

  // 3. o próprio UID → deve dar true
  console.log('3 (esperado true):', await verificarAcesso(auth.currentUser!.uid));

  // 4. UID de outra pessoa → deve dar erro de permissão
  try {
    await verificarAcesso('uid-de-outra-pessoa');
  } catch (e) {
    console.log('4 (esperado erro):', (e as Error).message);
  }

  // 5. sair → o observarSessao deve avisar "ninguém"
  await sair();
}

teste();