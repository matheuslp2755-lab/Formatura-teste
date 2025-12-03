import { GoogleGenAI, LiveSession, LiveServerMessage, Modality } from "@google/genai";

// Audio Context utilities
let audioContext: AudioContext | null = null;

export const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return audioContext;
};

// Base64 decoding
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Audio Buffer Decoding
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext
): Promise<AudioBuffer> {
  // Convert raw PCM to audio buffer manually or via decodeAudioData if it had headers (it doesn't).
  // The model returns raw PCM 16-bit 24kHz mono usually.
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

// Blob creation for input
export function createPcmBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  
  // Custom encode function instead of js-base64
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  return {
    data: base64,
    mimeType: 'audio/pcm;rate=16000',
  };
}

export const connectToLiveProducer = async (
  onAudioData: (buffer: AudioBuffer) => void,
  onClose: () => void
): Promise<LiveSession> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const session = await ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: () => console.log("AI Producer Connected"),
      onmessage: async (message: LiveServerMessage) => {
        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          const ctx = getAudioContext();
          const audioBytes = decode(base64Audio);
          const audioBuffer = await decodeAudioData(audioBytes, ctx);
          onAudioData(audioBuffer);
        }
      },
      onclose: () => {
        console.log("AI Producer Disconnected");
        onClose();
      },
      onerror: (e) => console.error("AI Producer Error", e),
    },
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: "Você é um Diretor de TV profissional da empresa MPLAY. Sua função é monitorar a transmissão da Formatura EASP 2025. Analise o vídeo e o áudio. Dê feedback curto e profissional ao operador da câmera sobre enquadramento, iluminação e qualidade do som. Se tudo estiver ótimo, diga que estamos prontos para transmitir.",
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
      }
    }
  });

  return session;
};
