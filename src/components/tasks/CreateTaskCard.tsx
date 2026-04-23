"use client";

import { db } from "@/lib/dexie";
import { Check, Clock, X, MapPin, Plus, Trash2, Save } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

interface CreateTaskCardProps {
    onClose: () => void;
    currentChatId?: string;
}

export default function CreateTaskCard({ onClose, currentChatId }: CreateTaskCardProps) {
    const router = useRouter();
    const { user } = useAuth();
    const todayStr = new Date().toISOString().split('T')[0];

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

            // After save, update URL to go to the actual view TaskCard and remove the /?n=1 flag
            if (currentChatId) {
                router.push(`/?c=${currentChatId}&t=${taskId}`);
            } else {
                router.push(`/?t=${taskId}`);
            }
        } catch (e) {
            console.error("Failed to save task manually", e);
            alert("Failed to save task.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 py-12 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-neutral-900 w-full max-w-md h-full max-h-[700px] rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-neutral-800">
                
                <div className="bg-neutral-800 p-4 pb-3 border-b border-neutral-700 flex flex-col shrink-0 relative">
                    <button onClick={onClose} className="absolute right-4 top-4 p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                    <h2 className="text-sm font-bold text-neutral-400 mb-3 uppercase tracking-wider">Create New Task</h2>
                    
                    <input 
                        type="text"
                        placeholder="Task Title *"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2.5 text-white font-medium focus:ring-1 focus:ring-[#e05012] focus:outline-none mb-3"
                        autoFocus
                    />

                    <div className="flex gap-2">
                        <div className="flex-1 flex items-center bg-neutral-950 border border-neutral-700 rounded-lg pr-2 focus-within:ring-1 focus-within:ring-[#e05012]">
                            <input 
                                type="date" 
                                min={todayStr} 
                                value={dueDate} 
                                onChange={e => setDueDate(e.target.value)} 
                                className="w-full bg-transparent p-2 text-sm text-neutral-200 color-scheme-dark focus:outline-none" 
                            />
                        </div>
                        <div className="flex-1 flex items-center bg-neutral-950 border border-neutral-700 rounded-lg pr-2 focus-within:ring-1 focus-within:ring-[#e05012]">
                            <input 
                                type="time" 
                                value={dueTime} 
                                onChange={e => setDueTime(e.target.value)} 
                                className="w-full bg-transparent p-2 text-sm text-neutral-200 color-scheme-dark focus:outline-none" 
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center bg-neutral-950 border border-neutral-700 rounded-lg pr-2 mt-3 focus-within:ring-1 focus-within:ring-[#e05012]">
                        <div className="pl-3 text-neutral-500"><MapPin size={16} /></div>
                        <input 
                            type="text" 
                            placeholder="Location (Optional)"
                            value={location} 
                            onChange={e => setLocation(e.target.value)} 
                            className="w-full bg-transparent p-2 text-sm text-neutral-200 focus:outline-none" 
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-neutral-900 flex flex-col gap-3 relative">
                    <h3 className="text-sm font-bold text-neutral-400 mb-1">Subtasks</h3>
                    
                    {subtasks.map((sub, idx) => (
                        <div key={idx} className="flex items-center gap-2 animate-in slide-in-from-top-2">
                             <div className="w-5 h-5 rounded border border-neutral-600 flex items-center justify-center shrink-0 opacity-50"></div>
                             <input 
                                type="text"
                                placeholder={`Subtask ${idx + 1}`}
                                value={sub}
                                onChange={(e) => handleUpdateSubtask(idx, e.target.value)}
                                className="flex-1 bg-neutral-800 border border-neutral-700 rounded-md p-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#e05012]"
                            />
                            <button onClick={() => handleRemoveSubtask(idx)} className="p-1.5 text-neutral-500 hover:text-red-400 rounded transition-colors">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}

                    <button 
                        onClick={handleAddSubtask}
                        className="flex items-center gap-1.5 text-[#e05012] hover:text-blue-400 font-semibold text-sm w-max transition-colors mt-2"
                    >
                        <Plus size={16} /> Add Subtask
                    </button>
                </div>

                <div className="bg-neutral-800 p-4 border-t border-neutral-700 shrink-0">
                    <button 
                        onClick={handleSave} 
                        disabled={!title.trim() || isSaving}
                        className="w-full font-semibold bg-[#e05012] hover:bg-[#e05012]/90 disabled:opacity-50 disabled:hover:bg-[#e05012] text-white p-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                        {isSaving ? "Saving..." : "Save Task"} <Save size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
