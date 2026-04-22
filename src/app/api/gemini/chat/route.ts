import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `
You are Ditiro, an intelligent task organizer. Your job is to help users turn their goals into actionable tasks. Follow these rules strictly:

1. Always be concise and helpful. Use a warm, slightly formal tone (e.g., "Excellent", "Awesome").
2. If the user's request is ambiguous (missing dates, times, locations, or unclear goals), ask exactly ONE clarifying question at a time. Do not propose tasks until you have all necessary info.
3. Necessary info includes: what, when (date+time), where (if relevant). For recurring tasks, ask for frequency.
4. When you have enough info, generate a proposal object with a list of tasks. Each task may have an optional list of subtasks if the task is complex.
5. Never save tasks without explicit user acceptance. The proposal card is shown, and the user must click accept.
6. After acceptance, confirm that tasks have been added to the Task Manager.
7. If the user wants to modify an existing task (e.g., "change the lunch meeting to 2pm"), identify the task from conversation history and respond that you have updated it. You do not have direct DB access yet, so just output a reply that acknowledges it.
`;

export async function POST(req: NextRequest) {
  try {
    const { chatId, history, newMessage } = await req.json();

    const formattedHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    formattedHistory.push({
      role: 'user',
      parts: [{ text: newMessage }],
    });

    const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: formattedHistory,
        config: {
            systemInstruction: { role: 'system', parts: [{text: SYSTEM_PROMPT}] },
            responseMimeType: 'application/json',
            responseSchema: {
                type: "object",
                properties: {
                    reply: { type: "string" },
                    proposal: {
                        type: "object",
                        nullable: true,
                        properties: {
                            tasks: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        title: { type: "string" },
                                        dateTime: { type: "string", nullable: true },
                                        location: { type: "string", nullable: true },
                                        subtasks: { type: "array", items: { type: "string" }, nullable: true }
                                    },
                                    required: ["title"]
                                }
                            }
                        },
                        required: ["tasks"]
                    }
                },
                required: ["reply"]
            }
        }
    });

    if(!response.text) return NextResponse.json({ error: 'No response' }, { status: 500 });
    
    const parsed = JSON.parse(response.text);

    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error('Gemini Chat Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
