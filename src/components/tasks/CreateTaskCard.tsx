"use client";

import { db } from "@/lib/dexie";
import { Check, Clock, X, MapPin, Plus, Trash2, Save } from "lucide-react";
import { useState, useRef } from "react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useDialog } from "@/components/ui/DialogProvider";

interface CreateTaskCardProps {
    onClose: () => void;
    currentChatId?: string;
}

export default function CreateTaskCard({ onClose, currentChatId }: CreateTaskCardProps) {
    const { showDialog } = useDialog();
    const router = useRouter();
    const { user } = useAuth();
    const todayStr = new Date().toISOString().split('T')[0];

    const dateInputRef = useRef<HTMLInputElement>(null);
    const timeInputRef = useRef<HTMLInputElement>(null);

    const [title, setTitle] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [location, setLocation] = useState("");
    const [subtasks, setSubtasks] = useState<string[]>([]);

    const [isSaving, setIsSaving] = useState(false);

    const handleAddSubtask = () => {
        setSubtasks([...subtasks, ""]);
    };

    const handleUpdateSubtask = (index: number, val: string) => {
        const newSubs = [...subtasks];
        newSubs[index] = val;
        setSubtasks(newSubs);
    };

    const handleRemoveSubtask = (index: number) => {
        const newSubs = [...subtasks];
        newSubs.splice(index, 1);
        setSubtasks(newSubs);
    };

    const [isSuccess, setIsSuccess] = useState(false);

    const handleSave = async () => {
        if (!title.trim() || isSaving) return;
        setIsSaving(true);

        const taskId = crypto.randomUUID();

        try {
            await db.tasks.add({
                id: taskId,
                chatId: currentChatId || undefined,
                title: title.trim(),
                status: 'active',
                dueDate: dueDate || undefined,
                dueTime: dueTime || undefined,
                location: location || undefined,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                userId: user?.uid || ""
            });

            const validSubtasks = subtasks.map(s => s.trim()).filter(Boolean);
            if (validSubtasks.length > 0) {
                const subs = validSubtasks.map((st, idx) => ({
                    id: crypto.randomUUID(),
                    taskId,
                    text: st,
                    completed: false,
                    order: idx,
                    userId: user?.uid || ""
                }));
                await db.subtasks.bulkAdd(subs);
            }

            setIsSuccess(true);
            
            // Short delay so they see the success state
            setTimeout(() => {
                if (currentChatId) {
                    router.push(`/?c=${currentChatId}&t=${taskId}`);
                } else {
                    router.push(`/?t=${taskId}`);
                }
            }, 800);

        } catch (e) {
            console.error("Failed to save task manually", e);
            showDialog({
                title: "Save Failed",
                message: "I couldn't save your task right now. Please check your connection and try again.",
                type: "alert"
            });
            setIsSaving(false);
        }
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 py-12 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-neutral-900 w-full max-w-md h-full max-h-[700px] rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl border border-neutral-800">
                
                <div className="bg-neutral-800/80 p-6 px-7 border-b border-neutral-700/50 flex flex-col shrink-0 relative">
                    <button onClick={onClose} className="absolute right-5 top-5 p-1.5 rounded-full hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all">
                        <X size={18} />
                    </button>
                    <div className="flex flex-col gap-1.5">
                        <div className="text-[10px] font-bold text-[#e05012] uppercase tracking-[0.2em] mb-1">New Action</div>
                        <input 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="What needs to be done?"
                            className="bg-transparent text-2xl font-bold text-white placeholder:text-neutral-700 focus:outline-none w-full"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-7 pt-5 bg-neutral-900 flex flex-col gap-6 custom-scrollbar">
                    {/* Schedule Section */}
                    <div className="flex flex-col gap-3">
                        <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest px-1">Schedule</h3>
                        <div className="flex gap-3">
                            <div 
                                className="relative flex-1 group cursor-pointer"
                                onClick={() => {
                                    try { (dateInputRef.current as any)?.showPicker(); } catch(e) { dateInputRef.current?.focus(); }
                                }}
                            >
                                <div className="flex items-center gap-3 p-3.5 bg-neutral-800/40 border border-neutral-700/50 rounded-2xl text-xs font-bold text-neutral-400 group-hover:border-[#e05012]/50 transition-all">
                                    <Clock size={16} className="text-[#e05012]" />
                                    <span>{dueDate || "Select Date"}</span>
                                </div>
                                <input 
                                    ref={dateInputRef}
                                    type="date" 
                                    min={todayStr} 
                                    value={dueDate} 
                                    onChange={e => setDueDate(e.target.value)} 
                                    className="absolute inset-0 opacity-0 cursor-pointer -z-10" 
                                />
                            </div>
                            <div 
                                className="relative flex-1 group cursor-pointer"
                                onClick={() => {
                                    try { (timeInputRef.current as any)?.showPicker(); } catch(e) { timeInputRef.current?.focus(); }
                                }}
                            >
                                <div className="flex items-center gap-3 p-3.5 bg-neutral-800/40 border border-neutral-700/50 rounded-2xl text-xs font-bold text-neutral-400 group-hover:border-[#e05012]/50 transition-all">
                                    <Clock size={16} className="text-[#e05012]" />
                                    <span>{dueTime || "Select Time"}</span>
                                </div>
                                <input 
                                    ref={timeInputRef}
                                    type="time" 
                                    value={dueTime} 
                                    onChange={e => setDueTime(e.target.value)} 
                                    className="absolute inset-0 opacity-0 cursor-pointer -z-10" 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Location Section */}
                    <div className="flex flex-col gap-3">
                        <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest px-1">Location</h3>
                        <div className="relative group">
                            <div className="flex items-center gap-3 p-3.5 bg-neutral-800/40 border border-neutral-700/50 rounded-2xl transition-all group-focus-within:border-[#e05012]/50">
                                <MapPin size={16} className="text-[#e05012]" />
                                <input 
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="Enter physical or virtual location..."
                                    className="bg-transparent text-xs font-bold text-white placeholder:text-neutral-600 focus:outline-none flex-1"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Subtasks Section */}
                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">Subtasks</h3>
                            <span className="text-[10px] font-bold text-neutral-600 bg-neutral-800/50 px-2.5 py-1 rounded-full">{subtasks.length}</span>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                            {subtasks.map((st, idx) => (
                                <div key={idx} className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 transition-all">
                                    <div className="flex-1 relative group">
                                        <div className="flex items-center gap-3 p-3 bg-neutral-800/20 border border-neutral-800 rounded-xl group-focus-within:border-[#e05012]/30 transition-all">
                                            <div className="w-4 h-4 rounded border border-neutral-700 flex-shrink-0" />
                                            <input 
                                                value={st}
                                                onChange={(e) => handleUpdateSubtask(idx, e.target.value)}
                                                className="bg-transparent text-xs font-medium text-neutral-200 focus:outline-none flex-1"
                                                autoFocus={idx === subtasks.length - 1}
                                            />
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveSubtask(idx)} className="p-2 text-neutral-600 hover:text-red-500 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            
                            <button 
                                onClick={handleAddSubtask}
                                className="w-full mt-1 p-3 rounded-xl border border-dashed border-neutral-800 hover:border-[#e05012]/30 hover:bg-[#e05012]/5 text-neutral-500 hover:text-[#e05012] transition-all flex items-center justify-center gap-2 text-xs font-bold"
                            >
                                <Plus size={16} /> Add Breakdown Item
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-neutral-800/80 p-6 px-7 border-t border-neutral-700/50 shrink-0">
                    <button 
                        onClick={handleSave} 
                        disabled={!title.trim() || isSaving || isSuccess}
                        className={clsx(
                            "w-full font-bold p-4 rounded-[1.5rem] flex items-center justify-center gap-3 transition-all duration-300 shadow-xl active:scale-[0.98]",
                            isSuccess 
                                ? "bg-green-600 text-white shadow-green-900/20" 
                                : "bg-[#e05012] hover:bg-[#e05012]/90 disabled:opacity-50 text-white shadow-[#e05012]/20"
                        )}
                    >
                        {isSuccess ? (
                            <>Saved Successfully <Check size={20} strokeWidth={3} /></>
                        ) : (
                            <>
                                {isSaving ? "Saving..." : "Create Task"} 
                                <Save size={18} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
