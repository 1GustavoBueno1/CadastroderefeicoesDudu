
import './index.css'
import {db} from './firebase.ts'
import {doc, getDoc} from 'firebase/firestore'


async function teste() {
  try {
    const snap = await getDoc(doc(db, 'usuarios', 'qualquercoisa'));
    console.log("existe?", snap.exists(), 'dados', snap.data());
  } catch (error) {
    console.error("deu bosta", error)
  }
}

teste()