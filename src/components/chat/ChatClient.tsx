"use client";

import { useAppStore } from "@/store";
import { useEffect, useState, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
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

    const handleSend = async (e?: React.FormEvent) => {
        if(e) e.preventDefault();
        if(!input.trim() || isLoading) return;

        const text = input.trim();
        setInput("");
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

        const userMsg: Message = {
            id: crypto.randomUUID(),
            chatId: cId,
            role: 'user',
            content: text,
            type: 'text',
            timestamp: Date.now()
        };
        await db.messages.add(userMsg);
        await db.chats.update(cId, { updatedAt: Date.now() });

        try {
            const history = messages?.map(m => ({ role: m.role, content: m.content })) || [];
            const res = await fetch('/api/gemini/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: cId,
                    history,
                    newMessage: text
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
        } finally {
            setIsLoading(false);
        }
    };

    const handleAcceptProposal = async (tasks: TaskProposal[], msgId: string) => {
        if(!currentChatId) return;
        
        for (const pt of tasks) {
            const taskId = crypto.randomUUID();
            await db.tasks.add({
                id: taskId,
                chatId: currentChatId,
                title: pt.title,
                status: 'active',
                dueDate: pt.dateTime?.includes(' ') ? pt.dateTime?.split(' ')[0] : pt.dateTime?.split('T')[0] || undefined,
                dueTime: pt.dateTime?.includes(' ') ? pt.dateTime?.split(' ')[1] : pt.dateTime?.split('T')[1]?.substring(0, 5) || undefined,
                location: pt.location || undefined,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                userId: null
            });

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
                            "flex w-full",
                            msg.role === 'user' ? "justify-end" : "justify-start"
                        )}>
                            <div className={clsx(
                                "max-w-[90%] sm:max-w-[75%] text-sm rounded-2xl px-5 py-3 leading-relaxed",
                                msg.role === 'user' ? "bg-neutral-800 text-neutral-100 rounded-br-sm" : "bg-transparent text-neutral-200 px-1"
                            )}>
                                {msg.content}
                                {msg.type === 'proposal' && msg.proposalData && (
                                    <div className="mt-4 w-full">
                                        <ProposalCard 
                                            tasks={msg.proposalData.tasks} 
                                            onAccept={(tasks) => handleAcceptProposal(tasks, msg.id)}
                                            onRejectAll={() => {}}
                                        />
                                    </div>
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
