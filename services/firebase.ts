import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";
import { getAuth, signInAnonymously } from "firebase/auth";
import { StreamStatus } from "../types";

// Configuração oficial fornecida pelo usuário
const firebaseConfig = {
  apiKey: "AIzaSyBscsAkO_yJYfVVtCBh3rNF8Cm51_HLW54",
  authDomain: "teste-rede-fcb99.firebaseapp.com",
  databaseURL: "https://teste-rede-fcb99-default-rtdb.firebaseio.com",
  projectId: "teste-rede-fcb99",
  storageBucket: "teste-rede-fcb99.firebasestorage.app",
  messagingSenderId: "1006477304115",
  appId: "1:1006477304115:web:e88d8e5f2e75d1b4df5e46"
};

// Fallback Key
const LOCAL_STORAGE_KEY = 'mplay_stream_status';

// Initialize Firebase
let db: any;
let auth: any;

try {
    const app = initializeApp(firebaseConfig);
    // Explicit URL provided to avoid region detection issues
    db = getDatabase(app, firebaseConfig.databaseURL);
    auth = getAuth(app);
    
    // Tentar login anônimo para resolver regras "auth != null"
    signInAnonymously(auth)
      .then(() => {
        console.log("Firebase: Autenticado como anônimo.");
      })
      .catch((err) => {
        // Silencioso em caso de erro para não alarmar usuário se as regras forem publicas
      });
      
    console.log("Firebase initialized");
} catch (error) {
    console.error("Erro crítico ao inicializar Firebase:", error);
}

// Diagnostics: Check if we can actually write to the DB
export const checkFirebaseConnection = async (): Promise<'connected' | 'denied' | 'error'> => {
  if (!db) return 'error';
  try {
    const testRef = ref(db, '_connection_test');
    await set(testRef, { timestamp: Date.now() });
    return 'connected';
  } catch (error: any) {
    if (error.code === 'PERMISSION_DENIED') {
      // Retorna 'denied' para a UI lidar, mas evita console.error explícito
      return 'denied';
    }
    return 'error';
  }
};

// Subscribe to stream status changes (Viewer)
export const subscribeToStreamStatus = (callback: (status: StreamStatus) => void) => {
  // 1. Configurar Listener Local (Fallback)
  const handleLocalChange = (e: StorageEvent) => {
    if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
      console.log("Status atualizado via LocalStorage:", e.newValue);
      callback(e.newValue as StreamStatus);
    }
  };
  window.addEventListener('storage', handleLocalChange);

  // Checar valor inicial local
  const savedStatus = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (savedStatus) {
    callback(savedStatus as StreamStatus);
  }

  // 2. Configurar Listener Remoto (Firebase)
  if (db) {
    const statusRef = ref(db, 'stream/status');
    
    try {
      onValue(statusRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          console.log("Status atualizado via Firebase:", data);
          callback(data as StreamStatus);
          localStorage.setItem(LOCAL_STORAGE_KEY, data);
        }
      }, (error) => {
          // Apenas warn simples
          console.warn(`Firebase Read Warning: ${error.code}`);
      });
    } catch (e) {
      console.warn("Erro ao configurar listener do Firebase:", e);
    }
  }

  return () => {
    window.removeEventListener('storage', handleLocalChange);
  };
};

// Update stream status (Admin)
export const updateStreamStatus = async (status: StreamStatus) => {
  console.log("Enviando atualização de status:", status);
  
  // 1. Atualizar Localmente
  try {
      localStorage.setItem(LOCAL_STORAGE_KEY, status);
      window.dispatchEvent(new StorageEvent('storage', {
          key: LOCAL_STORAGE_KEY,
          newValue: status
      }));
  } catch (e) {
      console.error("Erro no LocalStorage:", e);
  }
  
  // 2. Atualizar Remotamente
  if (db) {
    try {
      const statusRef = ref(db, 'stream/status');
      await set(statusRef, status);
      console.log("Status enviado ao Firebase com sucesso.");
    } catch (error: any) {
      if (error.code === 'PERMISSION_DENIED') {
         // Já tratado pela UI do AdminPanel via checkFirebaseConnection
      } else {
        console.error("Erro Firebase:", error.message);
      }
    }
  }
};