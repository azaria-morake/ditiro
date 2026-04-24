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
import CreateTaskCard from "@/components/tasks/CreateTaskCard";
import { DitiroIcon } from "../brand/Logos";
import { useAuth } from "@/components/auth/AuthProvider";
import { useDialog } from "@/components/ui/DialogProvider";

// Generate a deterministic stable ID for a task based on its identity
export const hashTaskIdentity = (title: string, date?: string | null, chatId?: string | null) => {
    const cleanTitle = title.trim().toLowerCase();
    const cleanDate = date?.split(' ')[0] || 'nodate'; // Just the date part
    const cleanChat = chatId || 'none';
    const raw = `${cleanTitle}|${cleanDate}`; // Global per user? No, per chat is safer for context
    // Simple hash for readability in DB
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(i);
        hash |= 0;
    }
    return `t-${Math.abs(hash).toString(36)}-${cleanChat.slice(0, 4)}`;
};

export default function ChatClient() {
    const { showDialog } = useDialog();
    const searchParams = useSearchParams();
    const router = useRouter();
    const cParam = searchParams?.get('c');
    const tParam = searchParams?.get('t');
    
    const { activeChatId, setActiveChatId } = useAppStore();
    const { user } = useAuth();
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const isAcceptingRef = useRef(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const nParam = searchParams?.get('n');

    const currentChatId = cParam || activeChatId;

    useEffect(() => {
        if(cParam !== activeChatId) {
            setActiveChatId(cParam);
        }
    }, [cParam, activeChatId, setActiveChatId]);

    const messages = useLiveQuery(
        () => currentChatId ? db.messages.where('chatId').equals(currentChatId).sortBy('timestamp') : Promise.resolve([] as Message[]),
        [currentChatId]
    );

    const allTasks = useLiveQuery(() => db.tasks.toArray());

    useEffect(() => {
        if (!messages || !allTasks || isAcceptingRef.current) return;
        
        const reconcile = async () => {
            for (const msg of messages) {
                if (msg.type === 'proposal' && msg.proposalData && msg.proposalData.tasks) {
                    const tasks = msg.proposalData.tasks;
                    const alreadyAccepted = msg.proposalData.acceptedIndices || [];
                    const nextAccepted = [...alreadyAccepted];
                    let changed = false;

                    tasks.forEach((pt, idx) => {
                        if (nextAccepted.includes(idx)) return;
                        
                        const stableId = pt.id || hashTaskIdentity(pt.title, pt.dateTime, currentChatId);
                        const match = allTasks.find(t => t.id === stableId || t.title.trim().toLowerCase() === pt.title.trim().toLowerCase());
                        
                        if (match) {
                            nextAccepted.push(idx);
                            changed = true;
                        }
                    });

                    if (changed) {
                        await db.messages.update(msg.id, {
                            proposalData: {
                                ...msg.proposalData,
                                acceptedIndices: nextAccepted
                            },
                            updatedAt: Date.now()
                        });
                    }
                }
            }
        };
        reconcile();
    }, [messages, allTasks]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        // Only auto-focus on desktop to prevent keyboard from popping up on mobile
        if (!isLoading && inputRef.current && window.innerWidth > 768) {
            inputRef.current.focus();
        }
    }, [isLoading]);

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
                userId: user?.uid || ""
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
                timestamp: Date.now(),
                updatedAt: Date.now(),
                userId: user?.uid || ""
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

            if(!res.ok) {
                const errData = await res.json().catch(() => null);
                throw new Error(errData?.error || "API failed");
            }
            const data = await res.json();
            
            const isProposal = !!data.proposal;
            const msgId = crypto.randomUUID();
            
            // Assign deterministic Stable IDs to proposed tasks and pre-match existing
            if (isProposal && data.proposal.tasks) {
                const currentTasks = await db.tasks.toArray();
                const initialAccepted: number[] = data.proposal.acceptedIndices || [];
                
                data.proposal.tasks = data.proposal.tasks.map((t: any, idx: number) => {
                    const stableId = t.id || hashTaskIdentity(t.title, t.dateTime, cId);
                    // If task already exists by ID or title, mark as accepted immediately
                    const exists = currentTasks.find(ct => ct.id === stableId || ct.title.trim().toLowerCase() === t.title.trim().toLowerCase());
                    if (exists && !initialAccepted.includes(idx)) {
                        initialAccepted.push(idx);
                    }
                    return { ...t, id: stableId };
                });
                data.proposal.acceptedIndices = initialAccepted;
            }
            
            const assistMsg: Message = {
                id: msgId,
                chatId: cId,
                role: 'assistant',
                content: data.reply,
                type: isProposal ? 'proposal' : 'text',
                proposalData: data.proposal,
                timestamp: Date.now(),
                updatedAt: Date.now(),
                userId: user?.uid || ""
            };
            
            await db.messages.add(assistMsg);
            await db.chats.update(cId, { updatedAt: Date.now() });
        } catch (error: any) {
            console.error("Failed to send message", error);
            const errorMsg: Message = {
                id: crypto.randomUUID(),
                chatId: cId,
                role: 'assistant',
                content: error.message && error.message !== "API failed" ? error.message : "I'm having trouble connecting to my brain right now! (Network/Server Error). Give me a moment and try again 😊",
                type: 'text',
                timestamp: Date.now(),
                updatedAt: Date.now(),
                userId: user?.uid || ""
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
        
        // Reset textarea height
        if (inputRef.current) {
            inputRef.current.style.height = '52px';
        }
        
        await executeMessage(text);
    };

    const handleRetry = async () => {
        if (!messages || messages.length === 0 || isLoading) return;
        
        const userMsgs = messages.filter(m => m.role === 'user');
        if (userMsgs.length === 0) return;
        
        const lastUserText = userMsgs[userMsgs.length - 1].content;
        
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === 'assistant') {
            await db.messages.delete(lastMsg.id);
        }

        await executeMessage(lastUserText, true);
    };

    const handleAcceptProposal = async (tasks: TaskProposal[], msgId: string) => {
        if(!currentChatId || isAcceptingRef.current) return;
        isAcceptingRef.current = true;
        console.log("[ChatClient] Accepting tasks:", tasks);
        
        try {
            await db.transaction('rw', [db.tasks, db.subtasks], async () => {
                for (const pt of tasks) {
                    const taskId = pt.id;
                    if (!taskId) continue; // Should not happen with stable IDs
                    
                    const taskData = {
                        id: taskId,
                        chatId: currentChatId,
                        title: pt.title,
                        status: 'active' as const,
                        dueDate: pt.dateTime?.includes(' ') ? pt.dateTime?.split(' ')[0] : pt.dateTime?.split('T')[0] || undefined,
                        dueTime: pt.dateTime?.includes(' ') ? pt.dateTime?.split(' ')[1] : pt.dateTime?.split('T')[1]?.substring(0, 5) || undefined,
                        location: pt.location || undefined,
                        updatedAt: Date.now(),
                        userId: user?.uid || ""
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
                            order: idx,
                            userId: user?.uid || ""
                        }));
                        await db.subtasks.bulkAdd(subs);
                    }
                }
            });
        } catch (err) {
            console.error("Failed to persist tasks:", err);
            showDialog({
                title: "Database Error",
                message: "I had some trouble saving those tasks to your local database. Please try again in a moment.",
                type: "alert"
            });
        } finally {
            isAcceptingRef.current = false;
        }
    };

    const handleProposalStateChange = async (msgId: string, accepted: number[], rejected: number[], updatedTasks: TaskProposal[]) => {
        console.log("[ChatClient] Updating proposal state for message:", msgId, "Accepted:", accepted);
        const msg = await db.messages.get(msgId);
        if (msg && msg.proposalData) {
            await db.messages.update(msgId, {
                proposalData: {
                    ...msg.proposalData,
                    tasks: updatedTasks,
                    acceptedIndices: accepted,
                    rejectedIndices: rejected
                },
                updatedAt: Date.now()
            });
            console.log("[ChatClient] Proposal state updated in Dexie.");
        }
    };

    return (
        <div className="flex flex-col h-full bg-neutral-950 relative">
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {!currentChatId || (messages?.length === 0) ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                        <DitiroIcon className="w-20 h-20 text-[#e05012] mb-6" />
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
                                    "text-sm rounded-2xl px-5 py-3 leading-relaxed whitespace-pre-wrap",
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
                        <div className="bg-transparent text-[#e05012] rounded-2xl px-2 py-3 flex items-center gap-2 text-sm italic font-medium">
                            <Loader2 className="animate-spin" size={16} /> Ditiro is thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-neutral-950 border-t border-neutral-900 relative z-10 shrink-0">
                <form onSubmit={handleSend} className="max-w-4xl mx-auto relative flex items-end">
                    <textarea 
                        ref={inputRef}
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            e.target.style.height = '52px';
                            const scrollHeight = e.target.scrollHeight;
                            e.target.style.height = scrollHeight > 150 ? '150px' : `${scrollHeight}px`;
                            e.target.style.overflowY = scrollHeight > 150 ? 'auto' : 'hidden';
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Type your task details here..."
                        disabled={isLoading}
                        rows={1}
                        style={{ overflowY: 'hidden' }}
                        className="w-full bg-neutral-900 border border-neutral-800 text-white rounded-3xl py-3.5 pl-6 pr-14 focus:outline-none focus:ring-1 focus:ring-[#e05012] transition-shadow disabled:opacity-50 text-sm resize-none min-h-[52px] leading-relaxed"
                    />
                    <button 
                        type="submit" 
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 shrink-0 bottom-[9px] p-2 bg-[#e05012] hover:bg-[#e05012]/80 text-white rounded-full disabled:opacity-50 disabled:hover:bg-[#e05012] transition-colors"
                    >
                        <DitiroIcon className="w-[18px] h-[18px] text-white" />
                    </button>
                </form>
            </div>

            {tParam && (
               <TaskCard taskId={tParam} onClose={() => router.push(cParam ? '/?c=' + cParam : '/')} />
            )}

            {nParam && (
               <CreateTaskCard currentChatId={currentChatId || undefined} onClose={() => router.push(cParam ? '/?c=' + cParam : '/')} />
            )}
        </div>
    );
}
