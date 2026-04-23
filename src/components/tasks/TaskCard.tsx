"use client";

import { db } from "@/lib/dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Clock, X, ChevronRight, MessageSquare, Plus } from "lucide-react";
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
    const [editingParent, setEditingParent] = useState(false);
    
    const [newTargetDate, setNewTargetDate] = useState("");
    const [newTargetTime, setNewTargetTime] = useState("");
    const [parentTargetDate, setParentTargetDate] = useState("");
    const [parentTargetTime, setParentTargetTime] = useState("");
    
    const [newSubtaskText, setNewSubtaskText] = useState("");
    
    const todayStr = new Date().toISOString().split('T')[0];

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

    const handleToggleParentTask = async () => {
        const newStatus = task.status === 'completed' ? 'active' : 'completed';
        await db.tasks.update(taskId, { status: newStatus });
        
        if (newStatus === 'completed' && subtasks) {
             const subIds = subtasks.filter(s => !s.completed).map(s => s.id);
             for(let sid of subIds) {
                 await db.subtasks.update(sid, { completed: true });
             }
        }
    };

    const handleSaveDelay = async (subtaskId: string, oldDate?: string) => {
        await db.subtasks.update(subtaskId, { 
            dueDate: newTargetDate || undefined, 
            dueTime: newTargetTime || undefined 
        });
        setEditingSubtask(null);
        
        try {
            const res = await fetch("/api/contextual-snackbar", {
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
            } else {
                setSnackbarMsg("Task updated.");
            }
        } catch(e) {
            setSnackbarMsg("Task updated.");
        }
    };

    const handleSaveParentDelay = async (oldDate?: string, oldTime?: string) => {
        await db.tasks.update(taskId, {
            dueDate: parentTargetDate || undefined,
            dueTime: parentTargetTime || undefined
        });
        setEditingParent(false);
        
        try {
            const res = await fetch("/api/contextual-snackbar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    taskTitle: task.title,
                    taskContext: originChat?.title || "general",
                    changedField: "dueDate",
                    oldValue: `${oldDate} ${oldTime}`,
                    newValue: `${parentTargetDate} ${parentTargetTime}`
                })
            });
            if(res.ok) {
                const data = await res.json();
                setSnackbarMsg(data.snackbarMessage);
            } else {
                setSnackbarMsg("Task details rescheduled.");
            }
        } catch(e) {
            setSnackbarMsg("Task details updated.");
        }
    };

    const handleAddManualSubtask = async () => {
        if (!newSubtaskText.trim()) return;
        
        const newOrder = subtasks ? subtasks.length : 0;
        await db.subtasks.add({
            id: crypto.randomUUID(),
            taskId,
            text: newSubtaskText.trim(),
            completed: false,
            order: newOrder
        });
        setNewSubtaskText("");
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 py-12 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-neutral-900 w-full max-w-md h-full max-h-[700px] rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-neutral-800">
                
                <div className="bg-neutral-800 p-4 border-b border-neutral-700 flex flex-col shrink-0 relative">
                    <button onClick={onClose} className="absolute right-4 top-4 p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                    <div className="flex items-start gap-4 pr-10">
                        <button onClick={handleToggleParentTask} 
                                className={clsx(
                                    "mt-1 w-6 h-6 rounded flex items-center justify-center border transition-colors shrink-0",
                                    task.status === 'completed' ? "bg-[#e05012] border-[#e05012] text-neutral-900" : "border-neutral-500 hover:border-[#e05012]"
                                )}>
                            {task.status === 'completed' && <Check size={16} strokeWidth={3} />}
                        </button>
                        <div className="flex-1 min-w-0 flex flex-col">
                            <h2 className={clsx(
                                "text-lg font-bold truncate transition-colors",
                                task.status === 'completed' ? "text-neutral-500 line-through" : "text-neutral-100"
                            )}>
                                {task.title}
                            </h2>
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-neutral-400">
                                <div className="font-medium">
                                    {totalSubs > 0 ? `${completedSubs}/${totalSubs} done` : "No subtasks"}
                                </div>
                                
                                {task.dueDate && !editingParent && (
                                    <div className="flex items-center gap-1 text-[#e05012] font-medium bg-[#e05012]/10 px-2 py-0.5 rounded">
                                        <Clock size={12} /> {task.dueDate} {task.dueTime}
                                    </div>
                                )}
                                
                                <button onClick={() => {
                                    setEditingParent(!editingParent);
                                    if(!editingParent) {
                                        setParentTargetDate(task.dueDate || "");
                                        setParentTargetTime(task.dueTime || "");
                                    }
                                }} className="flex items-center gap-1.5 text-neutral-400 hover:text-[#e05012] bg-neutral-900 px-2 py-0.5 rounded border border-neutral-700 hover:border-[#e05012]/50 transition-colors">
                                    <Clock size={12} /> <span className="text-xs font-semibold">Reschedule</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {editingParent && (
                    <div className="bg-neutral-800 border-b border-neutral-700 p-3 px-4 flex flex-col gap-2 shrink-0 animate-in slide-in-from-top-2">
                        <div className="text-xs text-neutral-400 font-medium mb-1">Reschedule {task.title}</div>
                        <div className="flex gap-2">
                            <input type="date" min={todayStr} value={parentTargetDate} onChange={e => setParentTargetDate(e.target.value)} className="flex-1 bg-neutral-950 border border-neutral-700 rounded p-1.5 text-sm text-neutral-200 color-scheme-dark" />
                            <input type="time" value={parentTargetTime} onChange={e => setParentTargetTime(e.target.value)} className="flex-1 bg-neutral-950 border border-neutral-700 rounded p-1.5 text-sm text-neutral-200 color-scheme-dark" />
                        </div>
                        <button onClick={() => handleSaveParentDelay(task.dueDate, task.dueTime)} className="w-full bg-[#e05012] hover:bg-[#e05012]/90 text-white rounded py-2 text-xs font-semibold mt-1">
                            Save Reschedule
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 bg-neutral-900 flex flex-col gap-3 relative">
                    {subtasks?.map(sub => (
                        <div key={sub.id} className="p-3 bg-neutral-800/50 rounded-xl border border-neutral-800 flex flex-col gap-2">
                            <div className="flex items-start gap-3">
                                <button onClick={() => handleToggleSubtask(sub.id, sub.completed)} 
                                        className={clsx(
                                            "mt-0.5 w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0",
                                            sub.completed ? "bg-[#e05012] border-[#e05012] text-neutral-900" : "border-neutral-500 hover:border-[#e05012]"
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
                                        <input type="date" min={todayStr} value={newTargetDate} onChange={e => setNewTargetDate(e.target.value)} className="flex-1 bg-neutral-950 border border-neutral-700 rounded p-1.5 text-sm text-neutral-200 color-scheme-dark" />
                                        <input type="time" value={newTargetTime} onChange={e => setNewTargetTime(e.target.value)} className="flex-1 bg-neutral-950 border border-neutral-700 rounded p-1.5 text-sm text-neutral-200 color-scheme-dark" />
                                    </div>
                                    <button onClick={() => handleSaveDelay(sub.id, sub.dueDate)} className="w-full bg-[#e05012] hover:bg-[#e05012]/90 text-white rounded py-1.5 text-xs font-semibold mt-1">
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
                    <div className="mt-2 p-3 bg-neutral-800/30 rounded-xl border border-dashed border-neutral-700 flex items-center gap-3">
                        <div className="w-5 h-5 rounded border border-neutral-600 flex items-center justify-center shrink-0 opacity-30"></div>
                        <input 
                            type="text"
                            placeholder="Add a subtask..."
                            value={newSubtaskText}
                            autoFocus
                            onChange={(e) => setNewSubtaskText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddManualSubtask();
                            }}
                            className="flex-1 bg-transparent text-sm text-neutral-200 focus:outline-none"
                        />
                        <button 
                            onClick={handleAddManualSubtask}
                            disabled={!newSubtaskText.trim()}
                            className="text-[#e05012] hover:text-blue-400 disabled:opacity-30 p-1 transition-colors"
                        >
                            <Plus size={20} />
                        </button>
                    </div>

                    {totalSubs === 0 && !newSubtaskText && (
                        <div className="text-center text-neutral-500 mt-10 text-sm">
                            Task items will appear here.
                        </div>
                    )}
                </div>

                {snackbarMsg && (
                    <div className="absolute bottom-20 w-max max-w-[90%] left-1/2 -translate-x-1/2 bg-[#ac3e0e] border border-[#e05012] text-white p-3 rounded-lg text-sm shadow-xl flex items-start gap-2 z-10 animate-in slide-in-from-bottom-5">
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
