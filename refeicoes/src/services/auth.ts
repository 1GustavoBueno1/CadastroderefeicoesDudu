import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    type User,
} from 'firebase/auth'
import { auth, db } from '../firebase'
import { doc, getDoc } from 'firebase/firestore'

export async function login(email: string, senha: string): Promise<void> { 
    try {
        await signInWithEmailAndPassword(auth, email.trim(), senha)
    } catch (error) {
        console.error("Email ou senha incorretos", error)
    }
}
 
export async function logout(): Promise<void> {
    try {
        await signOut(auth)
    } catch (error) {
        console.error("Erro ao deslogar", error)
    }
}

export function observarSessao(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback)
}

export async function verificarAcesso(uid: string): Promise<boolean> { 
        const snap = await getDoc(doc(db, 'usuarios', uid))
        return snap.exists() }