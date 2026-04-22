import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `
You are Ditiro, an intelligent task organizer. A user has updated a task or subtask.
Given the task details and the change, return a highly contextual, brief, warm, slightly formal snackbar message.
Example 1 (Meeting changed): "Task updated. Make sure you let them know about this new date if you haven't done so 🙂"
Example 2 (Exercise date changed): "Task updated. Don't forget to check here again 😊"
`;

export async function POST(req: NextRequest) {
  try {
    const { taskTitle, changedField, oldValue, newValue, taskContext } = await req.json();

    const prompt = `
Task Title: ${taskTitle}
Context: ${taskContext || 'general task'}
Changed Field: ${changedField}
Old Value: ${oldValue}
New Value: ${newValue}
`;

    const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [
            { role: 'user', parts: [{ text: prompt }] }
        ],
        config: {
            systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
            responseMimeType: 'application/json',
            responseSchema: {
                type: "object",
                properties: {
                    snackbarMessage: { type: "string" }
                },
                required: ["snackbarMessage"]
            }
        }
    });

    if(!response.text) return NextResponse.json({ error: 'No response' }, { status: 500 });
    
    const parsed = JSON.parse(response.text);

    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error('Gemini Snackbar Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
