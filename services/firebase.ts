import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";
import { StreamStatus } from "../types";

// --- COLE SUAS CREDENCIAIS DO FIREBASE AQUI ---
// Você encontra essas informações no Console do Firebase > Configurações do Projeto
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Initialize Firebase
let db: any;
try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    console.log("Firebase initialized successfully");
} catch (error) {
    console.warn("Erro ao inicializar Firebase. Verifique se você preencheu o firebaseConfig em services/firebase.ts");
    console.error(error);
}

// Subscribe to stream status changes (Viewer)
export const subscribeToStreamStatus = (callback: (status: StreamStatus) => void) => {
  if (!db) return () => {};
  
  const statusRef = ref(db, 'stream/status');
  
  const unsubscribe = onValue(statusRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data as StreamStatus);
    } else {
        // Default if empty
        callback(StreamStatus.OFFLINE);
    }
  });

  return unsubscribe;
};

// Update stream status (Admin)
export const updateStreamStatus = async (status: StreamStatus) => {
  if (!db) {
    alert("Firebase não configurado! Cole suas chaves no arquivo services/firebase.ts");
    return;
  }
  
  const statusRef = ref(db, 'stream/status');
  await set(statusRef, status);
};
