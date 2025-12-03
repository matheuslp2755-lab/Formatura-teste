import { Modality } from "@google/genai";

export enum StreamStatus {
  OFFLINE = 'OFFLINE',
  LIVE = 'LIVE',
  ENDED = 'ENDED'
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

// Helper types for Audio processing
export interface AudioQueueItem {
  buffer: AudioBuffer;
  duration: number;
}
