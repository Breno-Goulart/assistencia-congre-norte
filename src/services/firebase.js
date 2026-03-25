// Arquivo: src/services/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Suas credenciais oficiais do Firebase:
const firebaseConfig = {
  apiKey: "AIzaSyCzH--nHZ8aXETjnnRLOVl7eu2MEmFMGfo",
  authDomain: "assistencia-congre-norte.firebaseapp.com",
  projectId: "assistencia-congre-norte",
  storageBucket: "assistencia-congre-norte.firebasestorage.app",
  messagingSenderId: "438599349567",
  appId: "1:438599349567:web:cb821e50215bc419d74f8a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
