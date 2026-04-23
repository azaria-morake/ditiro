import { NextRequest, NextResponse } from 'next/server';
import { generateLLMResponse } from '@/lib/llm';

const SYSTEM_PROMPT = `
You are Ditiro, an intelligent task organizer. A user has updated a task or subtask.
Given the task details and the change, return a highly contextual, brief, warm, slightly formal snackbar message.
Example 1 (Meeting changed): "Task updated. Make sure you let them know about this new date if you haven't done so 🙂"
Example 2 (Exercise date changed): "Task updated. Don't forget to check here again 😊"

You MUST respond in JSON format with the following structure:
{
  "snackbarMessage": "your message"
}
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

    const responseText = await generateLLMResponse([
        { role: 'user', content: prompt }
    ], {
        system_instruction: SYSTEM_PROMPT,
        response_format: { type: "json_object" },
        model: "llama-3.1-8b-instant"
    });

    if(!responseText) return NextResponse.json({ error: 'No response' }, { status: 500 });
    
    const parsed = JSON.parse(responseText);

    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error('Groq Snackbar Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
