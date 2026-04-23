"use client";

import { useAppStore } from "@/store";
import { useEffect, useState, useRef } from "react";
import { Send, Loader2, RotateCcw } from "lucide-react";
import { db, Message } from "@/lib/dexie";
import { useLiveQuery } from "dexie-react-hooks";
import ProposalCard, { TaskProposal } from "./ProposalCard";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import TaskCard from "@/components/tasks/TaskCard";

export default function ChatClient() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const cParam = searchParams?.get('c');
    const tParam = searchParams?.get('t');
    
    const { activeChatId, setActiveChatId } = useAppStore();
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const currentChatId = cParam || activeChatId;

    useEffect(() => {
        if(cParam && cParam !== activeChatId) {
            setActiveChatId(cParam);
        }
    }, [cParam, activeChatId, setActiveChatId]);

    const messages = useLiveQuery(
        () => currentChatId ? db.messages.where('chatId').equals(currentChatId).sortBy('timestamp') : Promise.resolve([] as Message[]),
        [currentChatId]
    );

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const executeMessage = async (text: string, isRetry = false) => {
        if(!text.trim() || isLoading) return;
        setIsLoading(true);

        let cId = currentChatId;

        if(!cId) {
            cId = crypto.randomUUID();
            await db.chats.add({
                id: cId,
                title: text.slice(0, 30) + '...',
                emoji: '🗨️',
                timeIndicator: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                createdAt: Date.now(),
                updatedAt: Date.now(),
                userId: null
            });
            setActiveChatId(cId);
            router.push(`/?c=${cId}`);
        }

        if (!isRetry) {
            const userMsg: Message = {
                id: crypto.randomUUID(),
                chatId: cId,
                role: 'user',
                content: text,
                type: 'text',
                timestamp: Date.now()
            };
            await db.messages.add(userMsg);
        }
        await db.chats.update(cId, { updatedAt: Date.now() });

        try {
            const history = messages?.map(m => ({ role: m.role, content: m.content })) || [];
            
            const currentTasks = await db.tasks.where('chatId').equals(cId).toArray();
            const taskIds = currentTasks.map(t => t.id);
            const currentSubtasks = taskIds.length > 0 ? await db.subtasks.where('taskId').anyOf(taskIds).toArray() : [];
            
            const taskContext = currentTasks.map(t => ({
                id: t.id,
                title: t.title,
                status: t.status,
                dueDate: t.dueDate,
                dueTime: t.dueTime,
                subtasks: currentSubtasks.filter(s => s.taskId === t.id).map(s => ({ text: s.text, completed: s.completed, dueDate: s.dueDate, dueTime: s.dueTime }))
            }));

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: cId,
                    history,
                    newMessage: text,
                    taskContext
                })
            });

            if(!res.ok) throw new Error("API failed");
            const data = await res.json();
            
            const isProposal = !!data.proposal;
            
            const assistMsg: Message = {
                id: crypto.randomUUID(),
                chatId: cId,
                role: 'assistant',
                content: data.reply,
                type: isProposal ? 'proposal' : 'text',
                proposalData: data.proposal,
                timestamp: Date.now()
            };
            
            await db.messages.add(assistMsg);
            await db.chats.update(cId, { updatedAt: Date.now() });
        } catch (error) {
            console.error("Failed to send message", error);
            const errorMsg: Message = {
                id: crypto.randomUUID(),
                chatId: cId,
                role: 'assistant',
                content: "I'm having trouble connecting to my brain right now! (Network/Server Error). Give me a moment and try again 😊",
                type: 'text',
                timestamp: Date.now()
            };
            await db.messages.add(errorMsg);
            await db.chats.update(cId, { updatedAt: Date.now() });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async (e?: React.FormEvent) => {
        if(e) e.preventDefault();
        const text = input.trim();
        if(!text) return;
        setInput("");
        await executeMessage(text);
    };

    const handleRetry = async () => {
        if (!messages || messages.length === 0 || isLoading) return;
        
        const userMsgs = messages.filter(m => m.role === 'user');
        if (userMsgs.length === 0) return;
        
        const lastUserText = userMsgs[userMsgs.length - 1].content;
        
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === 'assistant' && lastMsg.content.includes("trouble connecting")) {
            await db.messages.delete(lastMsg.id);
        }

        await executeMessage(lastUserText, true);
    };

    const handleAcceptProposal = async (tasks: TaskProposal[], msgId: string) => {
        if(!currentChatId) return;
        console.log("Accepting tasks:", tasks);
        
        try {
            for (const pt of tasks) {
                const isUpdate = !!pt.id;
                const taskId = pt.id || crypto.randomUUID();
                
                const taskData = {
                    id: taskId,
                    chatId: currentChatId,
                    title: pt.title,
                    status: 'active' as const,
                    dueDate: pt.dateTime?.includes(' ') ? pt.dateTime?.split(' ')[0] : pt.dateTime?.split('T')[0] || undefined,
                    dueTime: pt.dateTime?.includes(' ') ? pt.dateTime?.split(' ')[1] : pt.dateTime?.split('T')[1]?.substring(0, 5) || undefined,
                    location: pt.location || undefined,
                    updatedAt: Date.now(),
                    userId: null
                };

                const existingTask = await db.tasks.get(taskId);

                if (existingTask) {
                    await db.tasks.update(taskId, taskData);
                    await db.subtasks.where('taskId').equals(taskId).delete();
                } else {
                    await db.tasks.add({ ...taskData, createdAt: Date.now() });
                }

                if (pt.subtasks && pt.subtasks.length > 0) {
                    const subs = pt.subtasks.map((st, idx) => ({
                        id: crypto.randomUUID(),
                        taskId,
                        text: st,
                        completed: false,
                        order: idx
                    }));
                    await db.subtasks.bulkAdd(subs);
                }
            }
        } catch (err) {
            console.error("Failed to persist tasks:", err);
            alert("Failed to save tasks to database. Please try again.");
        }
    };

    const handleProposalStateChange = async (msgId: string, accepted: number[], rejected: number[], updatedTasks: TaskProposal[]) => {
        const msg = await db.messages.get(msgId);
        if (msg && msg.proposalData) {
            await db.messages.update(msgId, {
                proposalData: {
                    ...msg.proposalData,
                    tasks: updatedTasks,
                    acceptedIndices: accepted,
                    rejectedIndices: rejected
                }
            });
        }
    };

    return (
        <div className="flex flex-col h-full bg-neutral-950 relative">
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {!currentChatId || (messages?.length === 0) ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                        <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center text-3xl mb-4 shadow-lg shadow-emerald-900/50">👋</div>
                        <h2 className="text-2xl font-bold text-neutral-100 mb-2">Hi, I'm Ditiro.</h2>
                        <p className="text-neutral-400 max-w-sm text-sm">Tell me what you need to get done, and I'll help you break it down.</p>
                    </div>
                ) : (
                    messages?.map(msg => (
                        <div key={msg.id} className={clsx(
                            "flex w-full group",
                            msg.role === 'user' ? "justify-end" : "justify-start"
                        )}>
                            <div className="flex flex-col max-w-[90%] sm:max-w-[75%]">
                                <div className={clsx(
                                    "text-sm rounded-2xl px-5 py-3 leading-relaxed",
                                    msg.role === 'user' ? "bg-neutral-800 text-neutral-100 rounded-br-sm ml-auto" : "bg-neutral-900/50 border border-neutral-800 text-neutral-200"
                                )}>
                                    {msg.content}
                                    {msg.type === 'proposal' && msg.proposalData && (
                                        <div className="mt-4 w-full">
                                            <ProposalCard 
                                                tasks={msg.proposalData.tasks} 
                                                onAccept={(tasks) => handleAcceptProposal(tasks, msg.id)}
                                                onRejectAll={() => handleProposalStateChange(msg.id, msg.proposalData?.acceptedIndices || [], msg.proposalData?.tasks.map((_, i) => i) || [], msg.proposalData?.tasks || [])}
                                                onOpenTask={(id) => router.push(currentChatId ? `/?c=${currentChatId}&t=${id}` : `/?t=${id}`)}
                                                initialAcceptedIndices={msg.proposalData.acceptedIndices}
                                                initialRejectedIndices={msg.proposalData.rejectedIndices}
                                                onStateChange={(acc, rej, tasks) => handleProposalStateChange(msg.id, acc, rej, tasks)}
                                            />
                                        </div>
                                    )}
                                </div>
                                {msg.role === 'assistant' && msg === messages[messages.length - 1] && !isLoading && (
                                    <button 
                                        onClick={handleRetry}
                                        className={clsx(
                                            "mt-2 ml-1 w-max flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold transition-colors py-1 px-2 rounded-md hover:bg-neutral-800",
                                            msg.content.includes("trouble connecting") ? "text-amber-500 hover:text-amber-400" : "text-neutral-500 hover:text-neutral-300"
                                        )}
                                    >
                                        <RotateCcw size={12} /> Retry last query
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-transparent text-neutral-500 rounded-2xl px-2 py-3 flex items-center gap-2 text-sm italic">
                            <Loader2 className="animate-spin" size={16} /> Ditiro is thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-neutral-950 border-t border-neutral-900 relative z-10">
                <form onSubmit={handleSend} className="max-w-4xl mx-auto relative flex items-center">
                    <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your task details here..."
                        disabled={isLoading}
                        className="w-full bg-neutral-900 border border-neutral-800 text-white rounded-full py-3.5 pl-6 pr-14 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-shadow disabled:opacity-50 text-sm"
                    />
                    <button 
                        type="submit" 
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full disabled:opacity-50 disabled:hover:bg-emerald-600 transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>

            {tParam && (
               <TaskCard taskId={tParam} onClose={() => router.push(cParam ? '/?c=' + cParam : '/')} />
            )}
        </div>
    );
}
