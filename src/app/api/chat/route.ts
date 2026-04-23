import { NextRequest, NextResponse } from 'next/server';
import { generateLLMResponse, LLMMessage } from '@/lib/llm';

const SYSTEM_PROMPT = `
You are Ditiro, an intelligent and proactive task organizer. Your job is to help users turn their goals into actionable tasks. Follow these rules strictly:

1.  **Tone**: Be concise, helpful, and natural. Avoid being pedantic.
2.  **Ambiguity & Proactivity**: If the user's request is ambiguous or lacks specific details, ask clarifying questions.
    - If the user mentions multiple items, ask for details for EACH item before proposing tasks.
    - **Subtasks**: Always clarify subtasks via conversation *before* generating a proposal card. The AI must reach a state of certainty about the subtasks before proposing them.
3.  **Task Modifications vs Duplicates**: 
    - You MUST use the "CURRENTLY SAVED TASKS" data to identify existing tasks. 
    - ONLY propose tasks that are NEW or require an UPDATE based on the latest message.
    - NEVER re-propose a task from CURRENTLY SAVED TASKS unless the user explicitly requested a change to it (e.g. changing its time, adding a subtask). Proposing an existing, unchanged task creates a confusing user experience.
    - If you DO update an existing task, YOU MUST include its "id" in the proposal object. If an "id" is present, the system will accurately update that task.
4.  **Date Handling**: South Africa (DD/MM/YYYY). ONLY allow future dates.
5.  **Task Proposals**: When you have enough info, generate a proposal object containing ONLY the tasks that need to be created or updated.

You MUST respond in JSON format with the following structure:
{
  "reply": "your conversational response",
  "proposal": {
    "tasks": [
      {
        "id": "ONLY include if modifying an existing task from CURRENTLY SAVED TASKS data",
        "title": "task title",
        "dateTime": "YYYY-MM-DD HH:mm",
        "location": "optional",
        "subtasks": ["sub 1", "sub 2"]
      }
    ]
  } // proposal is optional
}
`;

export async function POST(req: NextRequest) {
  try {
    const { chatId, history, newMessage, taskContext } = await req.json();
    const currentDateTime = new Date().toLocaleString();

    const contextBlock = taskContext && taskContext.length > 0
        ? `\n\n[CURRENT DATE: ${currentDateTime}]\n\nCURRENTLY SAVED TASKS IN DATABASE (Read-only - MUST prioritize this over chat history):\n${JSON.stringify(taskContext, null, 2)}`
        : `\n\n[CURRENT DATE: ${currentDateTime}]\n\nNo tasks are currently saved in the database.`;

    const messages: LLMMessage[] = [
      ...(history || []).map((msg: any) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      })),
      {
        role: 'user',
        content: newMessage + contextBlock,
      }
    ];

    const responseText = await generateLLMResponse(messages, {
      system_instruction: SYSTEM_PROMPT,
      response_format: { type: "json_object" },
      model: "llama-3.3-70b-versatile"
    });

    if(!responseText) return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      console.error("JSON Parse Error:", responseText);
      return NextResponse.json({ error: "Invalid JSON response from AI" }, { status: 500 });
    }

    // Ensure the response has the required fields
    if (!parsed.reply) {
      parsed.reply = "I've processed your request.";
    }

    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error('Groq Chat Error:', error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
