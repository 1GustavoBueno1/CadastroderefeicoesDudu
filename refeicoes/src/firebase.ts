import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";


const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

for (const [chave, valor] of Object.entries(config)) {
    if (!valor) throw new Error (`Falta a config "${chave} em .env.local`);
};
const app = initializeApp(config)

export const auth = getAuth(app);
export const db = getFirestore(app)

if (import.meta.env.VITE_USAR_EMULADOR == "true") {
        connectAuthEmulator(auth, "http://127.0.0.1:9099");
        connectFirestoreEmulator(db, '127.0.0.1', 8080);    
}