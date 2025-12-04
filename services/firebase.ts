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
let isFirebaseAvailable = false;

try {
    const app = initializeApp(firebaseConfig);
    // Explicit URL provided to avoid region detection issues
    db = getDatabase(app, firebaseConfig.databaseURL);
    auth = getAuth(app);
    
    // Tentar login anônimo para resolver regras "auth != null"
    signInAnonymously(auth)
      .then(() => {
        console.log("Firebase: Autenticado como anônimo.");
        isFirebaseAvailable = true;
      })
      .catch((err) => {
        console.warn("Firebase Auth Warning (usando fallback local):", err.message);
        // Não marcamos como indisponível imediatamente, tentamos conectar mesmo assim
        // pois as regras podem ser públicas
      });
      
    console.log("Firebase initialized");
} catch (error) {
    console.error("Erro crítico ao inicializar Firebase (usando modo offline):", error);
    isFirebaseAvailable = false;
}

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
  } else {
    callback(StreamStatus.OFFLINE);
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
          // Sincroniza local para garantir consistência
          localStorage.setItem(LOCAL_STORAGE_KEY, data);
        }
      }, (error) => {
          console.warn(`Firebase Permission Error: ${error.message}. Mantendo sincronização local.`);
          // Não fazemos nada drástico, apenas deixamos o fallback local funcionar
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
  // 1. Atualizar Localmente (Garante funcionamento imediato e entre abas)
  localStorage.setItem(LOCAL_STORAGE_KEY, status);
  
  // Dispara evento manual para a própria aba (storage event só dispara em outras abas)
  // Isso é importante se components usarem listeners
  
  // 2. Atualizar Remotamente (Firebase)
  if (db) {
    try {
      const statusRef = ref(db, 'stream/status');
      await set(statusRef, status);
      console.log("Status enviado ao Firebase com sucesso.");
    } catch (error: any) {
      console.error("Erro ao enviar para Firebase:", error.message);
      if (error.code === 'PERMISSION_DENIED') {
        console.info("NOTA: O Firebase bloqueou a escrita. O sistema continuará funcionando localmente (neste dispositivo). Para funcionar via internet, altere as regras no Console do Firebase.");
      }
    }
  } else {
    console.warn("Firebase não disponível. Status atualizado apenas localmente.");
  }
};