"use client";

import { db } from "@/lib/dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Clock, X, ChevronRight, MessageSquare } from "lucide-react";
import clsx from "clsx";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface TaskCardProps {
    taskId: string;
    onClose: () => void;
}

export default function TaskCard({ taskId, onClose }: TaskCardProps) {
    const router = useRouter();
    const task = useLiveQuery(() => db.tasks.get(taskId), [taskId]);
    const subtasks = useLiveQuery(() => db.subtasks.where('taskId').equals(taskId).sortBy('order'), [taskId]);
    const originChat = useLiveQuery(() => task?.chatId ? db.chats.get(task.chatId) : undefined, [task?.chatId]);
    
    const [snackbarMsg, setSnackbarMsg] = useState("");
    
    const [editingSubtask, setEditingSubtask] = useState<string | null>(null);
    const [newTargetDate, setNewTargetDate] = useState("");
    const [newTargetTime, setNewTargetTime] = useState("");

    useEffect(() => {
        if(snackbarMsg) {
            const t = setTimeout(() => setSnackbarMsg(""), 5000);
            return () => clearTimeout(t);
        }
    }, [snackbarMsg]);

    if (!task) return null;

    const completedSubs = subtasks?.filter(s => s.completed).length || 0;
    const totalSubs = subtasks?.length || 0;

    const handleToggleSubtask = async (id: string, currentlyCompleted: boolean) => {
        await db.subtasks.update(id, { completed: !currentlyCompleted });
    };

    const handleSaveDelay = async (subtaskId: string, oldDate?: string) => {
        await db.subtasks.update(subtaskId, { 
            dueDate: newTargetDate || undefined, 
            dueTime: newTargetTime || undefined 
        });
        setEditingSubtask(null);
        
        try {
            const res = await fetch("/api/gemini/contextual-snackbar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    taskTitle: task.title,
                    taskContext: originChat?.title || "general",
                    changedField: "dueDate",
                    oldValue: oldDate || "none",
                    newValue: `${newTargetDate} ${newTargetTime}`
                })
            });
            if(res.ok) {
                const data = await res.json();
                setSnackbarMsg(data.snackbarMessage);
            }
        } catch(e) {
            setSnackbarMsg("Task updated.");
        }
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-neutral-900 w-full max-w-md h-[80vh] sm:h-[600px] rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-neutral-800">
                
                <div className="bg-neutral-800 p-4 border-b border-neutral-700 flex flex-col shrink-0 relative">
                    <button onClick={onClose} className="absolute right-4 top-4 p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                    <div className="flex items-center gap-3 pr-8">
                        <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center text-xl shrink-0">
                            {originChat?.emoji || '📝'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-bold text-neutral-100 truncate">{task.title}</h2>
                            <p className="text-sm text-neutral-400">
                                {totalSubs > 0 ? `${completedSubs}/${totalSubs} done` : "No subtasks"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-neutral-900 flex flex-col gap-3 relative">
                    {subtasks?.map(sub => (
                        <div key={sub.id} className="p-3 bg-neutral-800/50 rounded-xl border border-neutral-800 flex flex-col gap-2">
                            <div className="flex items-start gap-3">
                                <button onClick={() => handleToggleSubtask(sub.id, sub.completed)} 
                                        className={clsx(
                                            "mt-0.5 w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0",
                                            sub.completed ? "bg-emerald-500 border-emerald-500 text-neutral-900" : "border-neutral-500 hover:border-emerald-400"
                                        )}>
                                    {sub.completed && <Check size={14} strokeWidth={3} />}
                                </button>
                                <div className={clsx(
                                    "flex-1 text-sm pt-0.5 transition-colors",
                                    sub.completed ? "text-neutral-500 line-through" : "text-neutral-200"
                                )}>
                                    {sub.text}
                                </div>
                                <button onClick={() => {
                                    setEditingSubtask(editingSubtask === sub.id ? null : sub.id);
                                    setNewTargetDate(sub.dueDate || "");
                                    setNewTargetTime(sub.dueTime || "");
                                }} className="p-1.5 text-neutral-400 hover:text-white rounded bg-neutral-800 hover:bg-neutral-700 transition-colors">
                                    <Clock size={16} />
                                </button>
                            </div>
                            
                            {editingSubtask === sub.id && (
                                <div className="mt-2 pl-8 pr-2 flex flex-col gap-2 animate-in slide-in-from-top-2">
                                    <div className="flex gap-2">
                                        <input type="date" value={newTargetDate} onChange={e => setNewTargetDate(e.target.value)} className="flex-1 bg-neutral-950 border border-neutral-700 rounded p-1.5 text-sm text-neutral-200 color-scheme-dark" />
                                        <input type="time" value={newTargetTime} onChange={e => setNewTargetTime(e.target.value)} className="flex-1 bg-neutral-950 border border-neutral-700 rounded p-1.5 text-sm text-neutral-200 color-scheme-dark" />
                                    </div>
                                    <button onClick={() => handleSaveDelay(sub.id, sub.dueDate)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded py-1.5 text-xs font-semibold mt-1">
                                        Update Details
                                    </button>
                                </div>
                            )}

                            {(sub.dueDate || sub.dueTime) && editingSubtask !== sub.id && (
                                <div className="pl-8 text-xs text-neutral-500 flex items-center gap-1 font-medium">
                                    <Clock size={12} /> {sub.dueDate} {sub.dueTime}
                                </div>
                            )}
                        </div>
                    ))}
                    {totalSubs === 0 && (
                        <div className="text-center text-neutral-500 mt-10 text-sm">
                            Task items will appear here.
                        </div>
                    )}
                </div>

                {snackbarMsg && (
                    <div className="absolute bottom-20 left-4 right-4 bg-emerald-900 border border-emerald-700 text-emerald-100 p-3 rounded-lg text-sm shadow-xl flex items-start gap-2 z-10 animate-in slide-in-from-bottom-5">
                        <span className="mt-0.5">💡</span>
                        <span>{snackbarMsg}</span>
                    </div>
                )}

                <div className="bg-neutral-800 p-4 border-t border-neutral-700 shrink-0">
                    <button onClick={() => {
                        onClose();
                        if (task.chatId) router.push(`/?c=${task.chatId}`);
                    }} className="w-full font-semibold bg-neutral-700 hover:bg-neutral-600 text-white p-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                        Open in Chat <MessageSquare size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
