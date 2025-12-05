import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, push, onChildAdded, remove, child, get, serverTimestamp } from "firebase/database";
import { getAuth, signInAnonymously } from "firebase/auth";
import { StreamStatus, ChatMessage, Graduate } from "../types";

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
    db = getDatabase(app, firebaseConfig.databaseURL);
    auth = getAuth(app);
    
    signInAnonymously(auth).catch(() => {});
      
    console.log("Firebase initialized");
} catch (error) {
    console.error("Erro crítico ao inicializar Firebase:", error);
}

// Diagnostics
export const checkFirebaseConnection = async (): Promise<'connected' | 'denied' | 'error'> => {
  if (!db) return 'error';
  try {
    const testRef = ref(db, '_connection_test');
    await set(testRef, { timestamp: Date.now() });
    return 'connected';
  } catch (error: any) {
    if (error.code === 'PERMISSION_DENIED') return 'denied';
    return 'error';
  }
};

// Stream Status
export const subscribeToStreamStatus = (callback: (status: StreamStatus) => void) => {
  const handleLocalChange = (e: StorageEvent) => {
    if (e.key === LOCAL_STORAGE_KEY && e.newValue) callback(e.newValue as StreamStatus);
  };
  window.addEventListener('storage', handleLocalChange);

  const savedStatus = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (savedStatus) callback(savedStatus as StreamStatus);

  if (db) {
    const statusRef = ref(db, 'stream/status');
    onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        callback(data as StreamStatus);
        localStorage.setItem(LOCAL_STORAGE_KEY, data);
      }
    });
  }

  return () => window.removeEventListener('storage', handleLocalChange);
};

export const updateStreamStatus = async (status: StreamStatus) => {
  try {
      localStorage.setItem(LOCAL_STORAGE_KEY, status);
      window.dispatchEvent(new StorageEvent('storage', { key: LOCAL_STORAGE_KEY, newValue: status }));
  } catch (e) {}
  
  if (db) {
    try {
      const statusRef = ref(db, 'stream/status');
      await set(statusRef, status);
      if (status === StreamStatus.ENDED) {
         remove(ref(db, 'stream/viewers'));
         // Optional: Clear chat on stream end? kept for history for now
      }
    } catch (error) {}
  }
};

// --- COUNTDOWN LOGIC ---
export const setStreamCountdown = async (targetTimestamp: number | null) => {
  if (!db) return;
  try {
    const countdownRef = ref(db, 'stream/countdown');
    await set(countdownRef, targetTimestamp);
  } catch (error) {
    console.error("Erro ao definir contagem:", error);
  }
};

export const listenToCountdown = (callback: (timestamp: number | null) => void) => {
  if (!db) return () => {};
  const countdownRef = ref(db, 'stream/countdown');
  const unsubscribe = onValue(countdownRef, (snapshot) => {
    callback(snapshot.val());
  });
  return unsubscribe;
};

// --- CHAT LOGIC ---

export const sendChatMessage = async (msg: Omit<ChatMessage, 'id'>) => {
  if (!db) return;
  const chatRef = ref(db, 'stream/chat');
  await push(chatRef, msg);
};

export const deleteChatMessage = async (messageId: string) => {
  if (!db) return;
  const msgRef = ref(db, `stream/chat/${messageId}`);
  try {
    await remove(msgRef);
  } catch (error) {
    console.error("Erro ao apagar mensagem:", error);
    // Silent fail or optional alert handling in UI
  }
};

export const listenToChatMessages = (onMessagesUpdate: (msgs: ChatMessage[]) => void) => {
  if (!db) return () => {};
  const chatRef = ref(db, 'stream/chat');
  
  // Alterado de onChildAdded para onValue para suportar deleções e sincronização completa da lista
  const unsubscribe = onValue(chatRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const messagesList = Object.entries(data).map(([key, value]: [string, any]) => ({
        id: key,
        ...value
      }));
      // Ordenar por timestamp
      messagesList.sort((a, b) => a.timestamp - b.timestamp);
      onMessagesUpdate(messagesList);
    } else {
      onMessagesUpdate([]);
    }
  });
  
  return unsubscribe;
};

// --- GRADUATES LOGIC ---

export const listenToGraduates = (callback: (graduates: Graduate[]) => void) => {
  if (!db) return () => {};
  const refPath = ref(db, 'stream/graduates');
  
  return onValue(refPath, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }

    // Mapeamento robusto para garantir que 'imageUrl' esteja sempre preenchido
    // VerificaimageUrl, image, foto, img, thumb, url
    const list: Graduate[] = Object.entries(data).map(([key, val]: [string, any]) => {
      const imageSource = 
        val.imageUrl || 
        val.image || 
        val.foto || 
        val.img || 
        val.thumb || 
        val.url || 
        '';

      return {
        id: key,
        name: val.name || 'Formando',
        course: val.course || '',
        imageUrl: imageSource
      };
    });

    callback(list);
  });
};

export const addGraduate = async (graduate: { name: string; course: string; imageUrl: string }) => {
  if (!db) return;
  const refPath = ref(db, 'stream/graduates');
  await push(refPath, graduate);
};

export const removeGraduate = async (id: string) => {
  if (!db) return;
  const refPath = ref(db, `stream/graduates/${id}`);
  await remove(refPath);
};


// --- WEBRTC SIGNALING ---

export const registerViewer = async (viewerId: string) => {
  if (!db) return;
  const viewerRef = ref(db, `stream/viewers/${viewerId}`);
  await set(viewerRef, { joined: Date.now() });
};

export const listenForViewers = (onNewViewer: (viewerId: string) => void) => {
  if (!db) return () => {};
  const viewersRef = ref(db, 'stream/viewers');
  const unsubscribe = onChildAdded(viewersRef, (snapshot) => {
    onNewViewer(snapshot.key as string);
  });
  return unsubscribe;
};

export const sendOffer = async (viewerId: string, offer: any) => {
  if (!db) return;
  await set(ref(db, `stream/viewers/${viewerId}/offer`), JSON.stringify(offer));
};

export const listenForAnswer = (viewerId: string, onAnswer: (answer: any) => void) => {
  if (!db) return;
  const answerRef = ref(db, `stream/viewers/${viewerId}/answer`);
  return onValue(answerRef, (snapshot) => {
    const data = snapshot.val();
    if (data) onAnswer(JSON.parse(data));
  });
};

export const sendIceCandidate = async (viewerId: string, candidate: any, source: 'admin' | 'viewer') => {
  if (!db) return;
  const path = source === 'admin' 
    ? `stream/viewers/${viewerId}/ice_admin` 
    : `stream/viewers/${viewerId}/ice_viewer`;
  await push(ref(db, path), JSON.stringify(candidate));
};

export const listenForIceCandidates = (viewerId: string, source: 'admin' | 'viewer', onCandidate: (candidate: any) => void) => {
  if (!db) return;
  const path = source === 'admin' 
    ? `stream/viewers/${viewerId}/ice_admin` 
    : `stream/viewers/${viewerId}/ice_viewer`;
  
  const unsubscribe = onChildAdded(ref(db, path), (snapshot) => {
    const data = snapshot.val();
    if (data) onCandidate(JSON.parse(data));
  });
  return unsubscribe;
};

// Viewer specific
export const listenForOffer = (viewerId: string, onOffer: (offer: any) => void) => {
  if (!db) return;
  const offerRef = ref(db, `stream/viewers/${viewerId}/offer`);
  return onValue(offerRef, (snapshot) => {
    const data = snapshot.val();
    if (data) onOffer(JSON.parse(data));
  });
};

export const sendAnswer = async (viewerId: string, answer: any) => {
  if (!db) return;
  await set(ref(db, `stream/viewers/${viewerId}/answer`), JSON.stringify(answer));
};