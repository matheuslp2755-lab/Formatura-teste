import { GoogleGenAI } from "@google/genai";

// Ensure API Key is available
const apiKey = process.env.API_KEY || '';

export const createGeminiClient = () => {
  if (!apiKey) {
    console.error("API_KEY is missing via process.env.API_KEY");
  }
  return new GoogleGenAI({ apiKey });
};

export const getEventAssistantResponse = async (userQuestion: string): Promise<string> => {
  if (!apiKey) return "Erro: Chave de API não configurada.";
  
  try {
    const ai = createGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userQuestion,
      config: {
        systemInstruction: "Você é um assistente virtual solícito para a 'Formatura EASP 2025'. Responda dúvidas dos convidados sobre a cerimônia. A empresa responsável é a MPLAY. O evento é solene e emocionante. Se perguntarem horários, invente algo plausível para o contexto de uma formatura noturna.",
      }
    });
    
    return response.text || "Desculpe, não consegui processar sua pergunta agora.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Tivemos um problema técnico momentâneo.";
  }
};
