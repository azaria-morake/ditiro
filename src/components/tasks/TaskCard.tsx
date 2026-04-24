"use client";

import { db } from "@/lib/dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Clock, X, MapPin, Plus, Trash2, MessageSquare } from "lucide-react";
import clsx from "clsx";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAppStore } from "@/store";
import { useDialog } from "@/components/ui/DialogProvider";

interface TaskCardProps {
    taskId: string;
    onClose: () => void;
}

export default function TaskCard({ taskId, onClose }: TaskCardProps) {
    const { showDialog } = useDialog();
    const router = useRouter();
    const { user } = useAuth();
    const task = useLiveQuery(() => db.tasks.get(taskId), [taskId]);
    const subtasks = useLiveQuery(() => db.subtasks.where('taskId').equals(taskId).sortBy('order'), [taskId]);
    const originChat = useLiveQuery(() => task?.chatId ? db.chats.get(task.chatId) : undefined, [task?.chatId]);
    
    const [snackbarMsg, setSnackbarMsg] = useState("");
    
    const dateInputRef = useRef<HTMLInputElement>(null);
    const timeInputRef = useRef<HTMLInputElement>(null);
    const subDateRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const subTimeRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

    const triggerContextualSnackbar = async (field: string, oldVal: string, newVal: string) => {
        try {
            const res = await fetch("/api/contextual-snackbar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    taskTitle: task.title,
                    taskContext: originChat?.title || "general",
                    changedField: field,
                    oldValue: oldVal,
                    newValue: newVal
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

    const handleToggleSubtask = async (id: string, currentlyCompleted: boolean) => {
        try {
            await db.subtasks.update(id, { completed: !currentlyCompleted });
            if (!currentlyCompleted) {
                triggerContextualSnackbar("subtaskStatus", "active", "completed");
            }
        } catch (err) {
            showDialog({
                title: "Update Failed",
                message: "I couldn't update that subtask. Please try again.",
                type: "alert"
            });
        }
    };

    const handleToggleParentTask = async () => {
        try {
            const newStatus = task.status === 'completed' ? 'active' : 'completed';
            await db.tasks.update(taskId, { status: newStatus });
            
            if (newStatus === 'completed') {
                triggerContextualSnackbar("status", "active", "completed");
                if (subtasks) {
                    const subIds = subtasks.filter(s => !s.completed).map(s => s.id);
                    for(let sid of subIds) {
                        await db.subtasks.update(sid, { completed: true });
                    }
                }
            } else {
                setSnackbarMsg("Task reactivated.");
            }
        } catch (err) {
            showDialog({
                title: "Update Failed",
                message: "I couldn't change the status of this task. Please try again.",
                type: "alert"
            });
        }
    };

    const handleSaveDelay = async (subtaskId: string, oldDate?: string) => {
        try {
            await db.subtasks.update(subtaskId, { 
                dueDate: newTargetDate || undefined, 
                dueTime: newTargetTime || undefined 
            });
            setEditingSubtask(null);
            triggerContextualSnackbar("dueDate", oldDate || "none", `${newTargetDate} ${newTargetTime}`);
        } catch (err) {
            showDialog({
                title: "Schedule Failed",
                message: "I couldn't update the subtask schedule. Please try again.",
                type: "alert"
            });
        }
    };

    const handleSaveParentDelay = async (oldDate?: string, oldTime?: string) => {
        try {
            await db.tasks.update(taskId, {
                dueDate: parentTargetDate || undefined,
                dueTime: parentTargetTime || undefined
            });
            setEditingParent(false);
            triggerContextualSnackbar("dueDate", `${oldDate} ${oldTime}`, `${parentTargetDate} ${parentTargetTime}`);
        } catch (err) {
            showDialog({
                title: "Schedule Failed",
                message: "I couldn't update the task schedule. Please try again.",
                type: "alert"
            });
        }
    };

    const handleAddManualSubtask = async () => {
        if (!newSubtaskText.trim()) return;
        
        try {
            const newOrder = subtasks ? subtasks.length : 0;
            await db.subtasks.add({
                id: crypto.randomUUID(),
                taskId,
                text: newSubtaskText.trim(),
                completed: false,
                order: newOrder,
                userId: user?.uid || ""
            });
            const addedText = newSubtaskText.trim();
            setNewSubtaskText("");
            triggerContextualSnackbar("subtaskAdded", "none", addedText);
        } catch (err) {
            showDialog({
                title: "Addition Failed",
                message: "I couldn't add that subtask. Please try again.",
                type: "alert"
            });
        }
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 py-12 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-neutral-900 w-full max-w-md h-full max-h-[700px] rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl border border-neutral-800">
                
                <div className="bg-neutral-800/80 p-6 px-7 border-b border-neutral-700/50 flex flex-col shrink-0 relative">
                    <button onClick={onClose} className="absolute right-5 top-5 p-1.5 rounded-full hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all">
                        <X size={18} />
                    </button>
                    <div className="flex items-start gap-4 pr-10">
                        <button onClick={handleToggleParentTask} 
                                className={clsx(
                                    "mt-1 w-6 h-6 rounded-lg flex items-center justify-center border transition-all duration-300 shrink-0",
                                    task.status === 'completed' ? "bg-[#e05012] border-[#e05012] text-neutral-900" : "border-neutral-600 hover:border-[#e05012]"
                                )}>
                            {task.status === 'completed' && <Check size={16} strokeWidth={3} />}
                        </button>
                        <div className="flex-1 min-w-0 flex flex-col">
                            <div className="text-[10px] font-bold text-[#e05012] uppercase tracking-[0.2em] mb-1">Task Details</div>
                            <h2 className={clsx(
                                "text-2xl font-bold truncate transition-all duration-300",
                                task.status === 'completed' ? "text-neutral-500 line-through" : "text-white"
                            )}>
                                {task.title}
                            </h2>
                            <div className="flex flex-wrap items-center gap-3 mt-2.5 text-[11px] font-bold uppercase tracking-wider">
                                <div className={clsx(
                                    "px-2 py-0.5 rounded-full border",
                                    task.status === 'completed' ? "border-neutral-700 text-neutral-600" : "border-[#e05012]/30 text-[#e05012] bg-[#e05012]/5"
                                )}>
                                    {totalSubs > 0 ? `${completedSubs}/${totalSubs} TASKS DONE` : "NO SUBTASKS"}
                                </div>
                                
                                {task.dueDate && !editingParent && (
                                    <div className="flex items-center gap-1.5 text-neutral-300">
                                        <Clock size={12} className="text-[#e05012]" /> {task.dueDate} {task.dueTime}
                                    </div>
                                )}
                                
                                <button onClick={() => {
                                    setEditingParent(!editingParent);
                                    if(!editingParent) {
                                        setParentTargetDate(task.dueDate || "");
                                        setParentTargetTime(task.dueTime || "");
                                    }
                                }} className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors">
                                    <Clock size={12} /> Reschedule
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {editingParent && (
                    <div className="bg-neutral-800/40 border-b border-neutral-700/50 p-6 px-7 flex flex-col gap-4 shrink-0 animate-in slide-in-from-top-2">
                        <div className="flex gap-3">
                            <div 
                                className="relative flex-1 group cursor-pointer"
                                onClick={() => {
                                    try { (dateInputRef.current as any)?.showPicker(); } catch(e) { dateInputRef.current?.focus(); }
                                }}
                            >
                                <div className="flex items-center gap-3 p-3.5 bg-neutral-900 border border-neutral-700 rounded-2xl text-xs font-bold text-neutral-400 group-hover:border-[#e05012]/50 transition-all">
                                    <Clock size={16} className="text-[#e05012]" />
                                    <span>{parentTargetDate || "Pick Date"}</span>
                                </div>
                                <input 
                                    ref={dateInputRef}
                                    type="date" 
                                    min={todayStr} 
                                    value={parentTargetDate} 
                                    onChange={e => setParentTargetDate(e.target.value)} 
                                    className="absolute inset-0 opacity-0 cursor-pointer -z-10" 
                                />
                            </div>
                            <div 
                                className="relative flex-1 group cursor-pointer"
                                onClick={() => {
                                    try { (timeInputRef.current as any)?.showPicker(); } catch(e) { timeInputRef.current?.focus(); }
                                }}
                            >
                                <div className="flex items-center gap-3 p-3.5 bg-neutral-900 border border-neutral-700 rounded-2xl text-xs font-bold text-neutral-400 group-hover:border-[#e05012]/50 transition-all">
                                    <Clock size={16} className="text-[#e05012]" />
                                    <span>{parentTargetTime || "Pick Time"}</span>
                                </div>
                                <input 
                                    ref={timeInputRef}
                                    type="time" 
                                    value={parentTargetTime} 
                                    onChange={e => setParentTargetTime(e.target.value)} 
                                    className="absolute inset-0 opacity-0 cursor-pointer -z-10" 
                                />
                            </div>
                        </div>
                        <button onClick={() => handleSaveParentDelay(task.dueDate, task.dueTime)} className="w-full bg-[#e05012] hover:bg-[#e05012]/90 text-white rounded-[1.5rem] py-4 text-sm font-bold shadow-lg shadow-[#e05012]/20 transition-all active:scale-[0.98]">
                            Save Reschedule
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-7 bg-neutral-900 flex flex-col gap-6 relative custom-scrollbar">
                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">Subtasks</h3>
                            <span className="text-[10px] font-bold text-neutral-600 bg-neutral-800/50 px-2.5 py-1 rounded-full">{totalSubs}</span>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                            {subtasks?.map(sub => (
                                <div key={sub.id} className="group p-4 bg-neutral-800/40 rounded-[1.25rem] border border-neutral-800 hover:border-neutral-700 transition-all">
                                    <div className="flex items-start gap-4">
                                        <button onClick={() => handleToggleSubtask(sub.id, sub.completed)} 
                                                className={clsx(
                                                    "mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border transition-all duration-300 shrink-0",
                                                    sub.completed ? "bg-[#e05012] border-[#e05012] text-neutral-900" : "border-neutral-600 hover:border-[#e05012]"
                                                )}>
                                            {sub.completed && <Check size={14} strokeWidth={3} />}
                                        </button>
                                        <div className={clsx(
                                            "flex-1 text-[13px] pt-0.5 transition-all duration-300",
                                            sub.completed ? "text-neutral-500 line-through font-medium" : "text-neutral-200 font-semibold"
                                        )}>
                                            {sub.text}
                                        </div>
                                        <button onClick={() => {
                                            setEditingSubtask(editingSubtask === sub.id ? null : sub.id);
                                            setNewTargetDate(sub.dueDate || "");
                                            setNewTargetTime(sub.dueTime || "");
                                        }} className={clsx(
                                            "p-1.5 rounded-lg transition-all",
                                            editingSubtask === sub.id ? "bg-[#e05012] text-neutral-900" : "text-neutral-500 hover:text-white hover:bg-neutral-800"
                                        )}>
                                            <Clock size={15} />
                                        </button>
                                    </div>
                                    
                                    {editingSubtask === sub.id && (
                                        <div className="mt-4 pl-9 pr-1 flex flex-col gap-3 animate-in slide-in-from-top-2">
                                            <div className="flex gap-2">
                                                <div 
                                                    className="relative flex-1 group cursor-pointer"
                                                    onClick={() => {
                                                        try { (subDateRefs.current[sub.id] as any)?.showPicker(); } catch(e) { subDateRefs.current[sub.id]?.focus(); }
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2 p-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-[10px] font-bold text-neutral-400 group-hover:border-[#e05012]/50 transition-all">
                                                        <Clock size={12} className="text-[#e05012]" />
                                                        <span>{newTargetDate || "Date"}</span>
                                                    </div>
                                                    <input 
                                                        ref={el => { subDateRefs.current[sub.id] = el; }}
                                                        type="date" min={todayStr} value={newTargetDate} onChange={e => setNewTargetDate(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer -z-10" 
                                                    />
                                                </div>
                                                <div 
                                                    className="relative flex-1 group cursor-pointer"
                                                    onClick={() => {
                                                        try { (subTimeRefs.current[sub.id] as any)?.showPicker(); } catch(e) { subTimeRefs.current[sub.id]?.focus(); }
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2 p-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-[10px] font-bold text-neutral-400 group-hover:border-[#e05012]/50 transition-all">
                                                        <Clock size={12} className="text-[#e05012]" />
                                                        <span>{newTargetTime || "Time"}</span>
                                                    </div>
                                                    <input 
                                                        ref={el => { subTimeRefs.current[sub.id] = el; }}
                                                        type="time" value={newTargetTime} onChange={e => setNewTargetTime(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer -z-10" 
                                                    />
                                                </div>
                                            </div>
                                            <button onClick={() => handleSaveDelay(sub.id, sub.dueDate)} className="w-full bg-[#e05012] hover:bg-[#e05012]/90 text-white rounded-xl py-3 text-[11px] font-bold transition-all active:scale-[0.98]">
                                                Update Subtask
                                            </button>
                                        </div>
                                    )}

                                    {(sub.dueDate || sub.dueTime) && editingSubtask !== sub.id && (
                                        <div className="pl-9 mt-1.5 text-[10px] text-neutral-500 flex items-center gap-1.5 font-bold uppercase tracking-tight">
                                            <Clock size={10} className="text-[#e05012]" /> {sub.dueDate} {sub.dueTime}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="mt-2 p-4 bg-neutral-800/20 rounded-[1.25rem] border border-dashed border-neutral-700 hover:border-neutral-500 transition-all flex items-center gap-4 group">
                        <div className="w-5 h-5 rounded-md border border-neutral-600 flex items-center justify-center shrink-0 opacity-30 group-hover:opacity-50 transition-opacity"></div>
                        <input 
                            type="text"
                            placeholder="Add a subtask..."
                            value={newSubtaskText}
                            onChange={(e) => setNewSubtaskText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddManualSubtask();
                            }}
                            className="flex-1 bg-transparent text-[13px] font-semibold text-neutral-200 focus:outline-none placeholder:text-neutral-600"
                        />
                        <button 
                            onClick={handleAddManualSubtask}
                            disabled={!newSubtaskText.trim()}
                            className="text-[#e05012] hover:text-white disabled:opacity-20 p-1.5 transition-all active:scale-90"
                        >
                            <Plus size={22} />
                        </button>
                    </div>

                    {totalSubs === 0 && !newSubtaskText && (
                        <div className="text-center text-neutral-500 mt-10 text-sm italic">
                            Task items will appear here.
                        </div>
                    )}
                </div>

                <div className="bg-neutral-800/80 p-6 px-7 border-t border-neutral-700/50 shrink-0">
                    <button onClick={() => {
                        onClose();
                        if (task.chatId) router.push(`/?c=${task.chatId}`);
                    }} className="w-full font-bold bg-neutral-700 hover:bg-[#e05012]/10 hover:text-[#e05012] text-white p-4 rounded-[1.5rem] flex items-center justify-center gap-3 transition-all duration-300 shadow-xl active:scale-[0.98]">
                        Open in Chat <MessageSquare size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
