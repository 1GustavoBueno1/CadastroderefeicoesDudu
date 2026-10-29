import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    type User,
} from 'firebase/auth'
import { auth, db } from '../firebase'
import { doc, getDoc } from 'firebase/firestore'
import { FirebaseError } from 'firebase/app';

export async function entrar(email: string, senha: string): Promise<void> { 
    try {
  await signInWithEmailAndPassword(auth, email, senha);
} catch (e) {
  if (e instanceof FirebaseError) {
    switch (e.code) {
    case 'auth/invalid-credential':
        throw new Error('Credenciais inválidas. Verifique seu email e senha.');
    case 'auth/wrong-password':
    throw new Error('Email ou senha inválidos');
    case 'auth/user-not-found':
    throw new Error('Usuário não encontrado');
    case 'auth/too-many-requests':
    throw new Error('Muitas tentativas de login. Tente novamente mais tarde.');
    case 'auth/network-request-failed':
    throw new Error('Erro de rede. Verifique sua conexão com a internet.');
   case "auth/invalid-email":
        throw new Error("Email inválido. Verifique o formato do email.");
  }}
  throw new Error("Erro desconhecido")
}}
 
export async function sair(): Promise<void> {
    try {
        await signOut(auth)
    } catch (error) {
        throw new Error("erro ao deslogar")
    }
}

export function observarSessao(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback)
}

export async function verificarAcesso(uid: string): Promise<boolean> { 
        const snap = await getDoc(doc(db, 'usuarios', uid))
        return snap.exists() }