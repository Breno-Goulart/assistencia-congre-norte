import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';

// 1. Configuração Segura
// Lemos as credenciais diretamente das variáveis de ambiente injetadas pelo Vite
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 2. Inicialização Principal do Firebase
const app = initializeApp(firebaseConfig);

// 3. Inicialização do Auth (Autenticação)
export const auth = getAuth(app);

// 4. Inicialização do Firestore com Cache Offline Avançado
// Substituímos o 'getFirestore()' padrão por 'initializeFirestore' para podermos injetar configurações
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    // Permite que o cache offline funcione de forma segura mesmo se o usuário 
    // abrir o aplicativo em múltiplas abas do navegador ao mesmo tempo.
    tabManager: persistentMultipleTabManager()
  })
});