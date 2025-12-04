import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";
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

// Initialize Firebase
let db: any;
try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    console.log("Firebase initialized successfully with Project ID:", firebaseConfig.projectId);
} catch (error) {
    console.error("Erro ao inicializar Firebase:", error);
}

// Subscribe to stream status changes (Viewer)
// Essa função fica "ouvindo" o banco de dados. Quando muda lá, avisa o site.
export const subscribeToStreamStatus = (callback: (status: StreamStatus) => void) => {
  if (!db) {
    console.warn("Firebase DB not ready for subscription");
    return () => {};
  }
  
  const statusRef = ref(db, 'stream/status');
  
  const unsubscribe = onValue(statusRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data as StreamStatus);
    } else {
        // Se não tiver nada no banco, assume OFFLINE
        callback(StreamStatus.OFFLINE);
    }
  }, (error) => {
      console.error("Erro ao ler dados do Firebase:", error);
  });

  return unsubscribe;
};

// Update stream status (Admin)
// Essa função envia o comando para o banco de dados.
export const updateStreamStatus = async (status: StreamStatus) => {
  if (!db) {
    console.error("Firebase database not initialized");
    alert("Erro crítico: Banco de dados não conectado.");
    return;
  }
  
  try {
    const statusRef = ref(db, 'stream/status');
    await set(statusRef, status);
    console.log("Status atualizado para:", status);
  } catch (error) {
    console.error("Erro ao atualizar status da transmissão:", error);
    alert("Erro ao conectar com o servidor. Verifique sua conexão.");
  }
};