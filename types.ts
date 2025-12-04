import { Modality } from "@google/genai";

export enum StreamStatus {
  OFFLINE = 'OFFLINE',
  LIVE = 'LIVE',
  ENDED = 'ENDED'
}

export interface ChatMessage {
  id: string;
  sender: string; // Name of the user
  text: string;
  timestamp: number; // Unix timestamp for Firebase compatibility
  isMe?: boolean; // Helper for UI rendering (local only)
}

// Helper types for Audio processing
export interface AudioQueueItem {
  buffer: AudioBuffer;
  duration: number;
}