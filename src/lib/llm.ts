import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

let groq: Groq | null = null;
function getGroq() {
  if (!groq) {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }
  return groq;
}

let genAI: GoogleGenerativeAI | null = null;
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    console.log("Initializing Gemini with API Key prefix:", apiKey.substring(0, 5) + "...");
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" | "text" };
  system_instruction?: string;
}

export async function generateLLMResponse(
  messages: LLMMessage[],
  options: LLMOptions = {}
) {
  const {
    model = "llama-3.3-70b-versatile",
    temperature = 0.7,
    max_tokens = 4096,
    response_format,
    system_instruction,
  } = options;

  const finalMessages = [...messages];
  if (system_instruction) {
    finalMessages.unshift({ role: "system", content: system_instruction });
  }

  try {
    const response = await getGroq().chat.completions.create({
      messages: finalMessages as any,
      model,
      temperature,
      max_tokens,
      response_format: response_format || undefined,
    });

    return response.choices[0]?.message?.content || "";
  } catch (error: any) {
    // Fallback to Gemini on Rate Limit (429)
    if (error?.status === 429 || error?.code === "rate_limit_exceeded") {
      console.warn("Groq Rate Limit Reached. Falling back to Gemini...");
      try {
        return await generateGeminiResponse(messages, options);
      } catch (geminiError) {
        console.error("Gemini Fallback Error:", geminiError);
        throw geminiError;
      }
    }
    
    console.error("Groq API Error:", error);
    throw error;
  }
}

async function generateGeminiResponse(
  messages: LLMMessage[],
  options: LLMOptions
) {
  const {
    temperature = 0.7,
    max_tokens = 4096,
    response_format,
    system_instruction,
  } = options;

  // Use a model name that was verified in the list.
  const modelName = "gemini-pro-latest"; 
  const geminiModel = getGenAI().getGenerativeModel({ 
    model: modelName,
    systemInstruction: system_instruction,
  });

  const generationConfig = {
    temperature,
    maxOutputTokens: max_tokens,
    responseMimeType: response_format?.type === "json_object" ? "application/json" : "text/plain",
  };

  const geminiMessages = messages.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const result = await geminiModel.generateContent({
    contents: geminiMessages,
    generationConfig,
  });

  const response = await result.response;
  return response.text();
}
