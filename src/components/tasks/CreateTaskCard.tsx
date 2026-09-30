"use client";

import { db } from "@/lib/dexie";
import { Check, Clock, X, MapPin, Plus, Trash2, Save, Sparkles } from "lucide-react";
import { useState, useRef, useMemo } from "react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useDialog } from "@/components/ui/DialogProvider";
import {
  SOUTH_AFRICAN_CITIES,
  calculateDailyPrayers,
  generatePrayerDeedsForToday,
  savePrayerRoutineConfig,
  PrayerRoutineConfig
} from "@/lib/prayers/prayerService";

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

    // Template Mode: 'standard' (Single Deed) | 'prayer_routine' (Islamic 5 Daily Salah)
    const [actionTemplate, setActionTemplate] = useState<'standard' | 'prayer_routine'>('standard');

    // Standard Deed State
    const [title, setTitle] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [remindersEnabled, setRemindersEnabled] = useState(true);
    const [reminderIntervalMinutes, setReminderIntervalMinutes] = useState<number>(30); // 30 mins default
    const [location, setLocation] = useState("");
    const [subtasks, setSubtasks] = useState<string[]>([]);

    // Islamic Prayer Routine State
    const [selectedCityId, setSelectedCityId] = useState<string>('jhb');
    const [madhab, setMadhab] = useState<'shafi' | 'hanafi'>('shafi');
    const [prayerReminders, setPrayerReminders] = useState<boolean>(true);
    const [prayerIntervalMinutes, setPrayerIntervalMinutes] = useState<number>(15);
    const [autoPrune, setAutoPrune] = useState<boolean>(true);

    const selectedCity = SOUTH_AFRICAN_CITIES.find(c => c.id === selectedCityId) || SOUTH_AFRICAN_CITIES[0];

    // Live prayer timings preview for the selected location
    const prayerSlots = useMemo(() => {
        return calculateDailyPrayers(
            { latitude: selectedCity.latitude, longitude: selectedCity.longitude },
            new Date(),
            madhab
        );
    }, [selectedCity, madhab]);

    const [isSaving, setIsSaving] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

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
        if (isSaving) return;

        // 1. ISLAMIC PRAYER ROUTINE SAVE HANDLER
        if (actionTemplate === 'prayer_routine') {
            setIsSaving(true);
            try {
                const config: PrayerRoutineConfig = {
                    enabled: true,
                    cityId: selectedCity.id,
                    cityName: `${selectedCity.name} (${selectedCity.shortName})`,
                    latitude: selectedCity.latitude,
                    longitude: selectedCity.longitude,
                    madhab,
                    remindersEnabled: prayerReminders,
                    alertFrequencyMinutes: prayerIntervalMinutes,
                    autoPruneExpired: autoPrune,
                    lastGeneratedDate: todayStr,
                    updatedAt: Date.now(),
                };

                // Save routine configuration
                await savePrayerRoutineConfig(user?.uid || "", config);

                // Generate today's 5 prayer deeds in database
                await generatePrayerDeedsForToday(user?.uid || "", config);

                setIsSuccess(true);
                setTimeout(() => {
                    if (currentChatId) {
                        router.push(`/?c=${currentChatId}`);
                    } else {
                        router.push(`/`);
                    }
                }, 800);
            } catch (e) {
                console.error("Failed to activate prayer routine", e);
                showDialog({
                    title: "Setup Failed",
                    message: "Failed to configure daily prayer routine. Please check your connection and try again.",
                    type: "alert"
                });
                setIsSaving(false);
            }
            return;
        }

        // 2. STANDARD DEED SAVE HANDLER
        if (!title.trim()) return;
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
                remindersEnabled: remindersEnabled,
                alertFrequencyMinutes: reminderIntervalMinutes,
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

            // Trigger Ditiro Drone Notification & Timer Subroutine
            if (user?.uid) {
              import("@/lib/drone/reminderDispatcher").then(({ registerOrUpdateTaskSubroutine }) => {
                registerOrUpdateTaskSubroutine({
                  id: taskId,
                  title: title.trim(),
                  dueDate: dueDate || undefined,
                  dueTime: dueTime || undefined,
                  userId: user.uid,
                  remindersEnabled,
                  reminderIntervalMs: reminderIntervalMinutes * 60 * 1000,
                });
              });
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
                
                {/* Header & Title */}
                <div className="bg-neutral-800/80 p-6 px-7 border-b border-neutral-700/50 flex flex-col shrink-0 relative">
                    <button onClick={onClose} className="absolute right-5 top-5 p-1.5 rounded-full hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all">
                        <X size={18} />
                    </button>
                    <div className="flex flex-col gap-1.5">
                        <div className="text-[10px] font-bold text-[#E35824] uppercase tracking-[0.2em] mb-1">
                            {actionTemplate === 'prayer_routine' ? 'Islamic Salah Routine' : 'New Action'}
                        </div>
                        <input 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={actionTemplate === 'prayer_routine' ? `Daily Prayers (Salah) · ${selectedCity.shortName}` : "What needs to be done?"}
                            className="bg-transparent text-2xl font-bold text-white placeholder:text-neutral-700 focus:outline-none w-full"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-7 pt-5 bg-neutral-900 flex flex-col gap-6 custom-scrollbar">
                    
                    {/* Action Template Selector Dropdown */}
                    <div className="flex flex-col gap-2.5">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                                <Sparkles size={13} className="text-[#E35824]" /> Action Template
                            </h3>
                            <span className="text-[10px] font-semibold text-neutral-400">
                                {actionTemplate === 'prayer_routine' ? '5 Deeds / Day' : '1 Custom Deed'}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setActionTemplate('standard');
                                    if (title.startsWith('Daily Prayers')) setTitle('');
                                }}
                                className={clsx(
                                    "py-2.5 px-3 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-2",
                                    actionTemplate === 'standard'
                                        ? "bg-[#E35824]/15 border-[#E35824] text-white shadow-sm shadow-[#E35824]/10"
                                        : "bg-neutral-800/40 border-neutral-700/50 text-neutral-400 hover:border-neutral-600"
                                )}
                            >
                                <span>📝</span> Custom Deed
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setActionTemplate('prayer_routine');
                                    setTitle(`Daily Prayers (Salah) · ${selectedCity.shortName}`);
                                }}
                                className={clsx(
                                    "py-2.5 px-3 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-2",
                                    actionTemplate === 'prayer_routine'
                                        ? "bg-[#E35824]/15 border-[#E35824] text-[#F5AF28] shadow-sm shadow-[#E35824]/10"
                                        : "bg-neutral-800/40 border-neutral-700/50 text-neutral-400 hover:border-neutral-600"
                                )}
                            >
                                <span>🕌</span> 5 Daily Prayers
                            </button>
                        </div>
                    </div>

                    {/* DYNAMIC PAYLOAD: ISLAMIC PRAYER ROUTINE */}
                    {actionTemplate === 'prayer_routine' ? (
                        <>
                            {/* Location Section */}
                            <div className="flex flex-col gap-2.5">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <MapPin size={13} className="text-[#E35824]" /> Location (South Africa)
                                    </h3>
                                    <span className="text-[10px] font-bold text-[#F5AF28]">
                                        {selectedCity.name}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {SOUTH_AFRICAN_CITIES.map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedCityId(c.id);
                                                setTitle(`Daily Prayers (Salah) · ${c.shortName}`);
                                            }}
                                            className={clsx(
                                                "py-2 px-2.5 rounded-xl text-xs font-bold transition-all border text-center",
                                                selectedCityId === c.id
                                                    ? "bg-[#E35824] border-[#E35824] text-white shadow-md shadow-[#E35824]/20"
                                                    : "bg-neutral-800/40 border-neutral-700/50 text-neutral-400 hover:border-neutral-600"
                                            )}
                                        >
                                            {c.shortName}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Live Astronomical Prayer Timings Preview */}
                            <div className="flex flex-col gap-2.5">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <Clock size={13} className="text-[#E35824]" /> Today's Calculated Timings
                                    </h3>
                                    <span className="text-[10px] font-semibold text-neutral-500">
                                        {madhab === 'shafi' ? 'MWL / Shafi' : 'Hanafi'}
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-5 gap-1.5 p-3 bg-neutral-800/30 border border-neutral-800 rounded-2xl">
                                    {prayerSlots.map((slot) => (
                                        <div key={slot.name} className="flex flex-col items-center justify-center p-2 rounded-xl bg-neutral-900/60 border border-neutral-800/80">
                                            <span className="text-base mb-1">{slot.icon}</span>
                                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{slot.name}</span>
                                            <span className="text-xs font-extrabold text-[#F5AF28] mt-0.5">{slot.timeStr}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 24-Hour Auto-Purge & Daily Cadence Notice */}
                            <div className="p-3.5 bg-neutral-800/25 border border-neutral-800 rounded-2xl flex items-start gap-3">
                                <span className="text-lg">⚡</span>
                                <div className="flex-1 text-xs">
                                    <div className="font-bold text-neutral-200">24-Hour Life Cycle & Sync</div>
                                    <div className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                                        5 deeds are generated automatically everyday using {selectedCity.name}'s exact astronomical times. Deeds from previous days are automatically cleared after 24h to keep your database lean.
                                    </div>
                                </div>
                            </div>

                            {/* Ditiro Drone Reminders */}
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <span>🛸</span> Ditiro Drone Alarms
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setPrayerReminders(!prayerReminders)}
                                        className={clsx(
                                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                            prayerReminders ? "bg-[#E35824]" : "bg-neutral-800"
                                        )}
                                    >
                                        <span
                                            className={clsx(
                                                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                                                prayerReminders ? "translate-x-4" : "translate-x-0"
                                            )}
                                        />
                                    </button>
                                </div>

                                {prayerReminders && (
                                    <div className="flex flex-col gap-2 p-3 bg-neutral-800/30 border border-neutral-800 rounded-2xl animate-in fade-in">
                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Alert Timing</span>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { label: 'At Time', val: 0 },
                                                { label: '10 mins early', val: 10 },
                                                { label: '15 mins early', val: 15 }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.val}
                                                    type="button"
                                                    onClick={() => setPrayerIntervalMinutes(opt.val)}
                                                    className={clsx(
                                                        "py-1.5 px-2 rounded-xl text-xs font-bold transition-all border",
                                                        prayerIntervalMinutes === opt.val
                                                            ? "bg-[#E35824]/15 border-[#E35824] text-[#E35824]"
                                                            : "bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                                                    )}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* DYNAMIC PAYLOAD: STANDARD CUSTOM DEED */
                        <>
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
                                        <div className="flex items-center gap-3 p-3.5 bg-neutral-800/40 border border-neutral-700/50 rounded-2xl text-xs font-bold text-neutral-400 group-hover:border-[#E35824]/50 transition-all">
                                            <Clock size={16} className="text-[#E35824]" />
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
                                        <div className="flex items-center gap-3 p-3.5 bg-neutral-800/40 border border-neutral-700/50 rounded-2xl text-xs font-bold text-neutral-400 group-hover:border-[#E35824]/50 transition-all">
                                            <Clock size={16} className="text-[#E35824]" />
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

                            {/* Ditiro Drone Reminders & Interval Controls */}
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <span>🛸</span> Ditiro Drone Reminders
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setRemindersEnabled(!remindersEnabled)}
                                        className={clsx(
                                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                            remindersEnabled ? "bg-[#E35824]" : "bg-neutral-800"
                                        )}
                                    >
                                        <span
                                            className={clsx(
                                                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                                                remindersEnabled ? "translate-x-4" : "translate-x-0"
                                            )}
                                        />
                                    </button>
                                </div>

                                {remindersEnabled && (
                                    <div className="flex flex-col gap-2 p-3 bg-neutral-800/30 border border-neutral-800 rounded-2xl animate-in fade-in">
                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Alert Frequency</span>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[15, 30, 60].map((mins) => (
                                                <button
                                                    key={mins}
                                                    type="button"
                                                    onClick={() => setReminderIntervalMinutes(mins)}
                                                    className={clsx(
                                                        "py-1.5 px-2 rounded-xl text-xs font-bold transition-all border",
                                                        reminderIntervalMinutes === mins
                                                            ? "bg-[#E35824]/15 border-[#E35824] text-[#E35824]"
                                                            : "bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                                                    )}
                                                >
                                                    {mins} mins
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Location Section */}
                            <div className="flex flex-col gap-3">
                                <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest px-1">Location</h3>
                                <div className="relative group">
                                    <div className="flex items-center gap-3 p-3.5 bg-neutral-800/40 border border-neutral-700/50 rounded-2xl transition-all group-focus-within:border-[#E35824]/50">
                                        <MapPin size={16} className="text-[#E35824]" />
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
                                                <div className="flex items-center gap-3 p-3 bg-neutral-800/20 border border-neutral-800 rounded-xl group-focus-within:border-[#E35824]/30 transition-all">
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
                                        className="w-full mt-1 p-3 rounded-xl border border-dashed border-neutral-800 hover:border-[#E35824]/30 hover:bg-[#E35824]/5 text-neutral-500 hover:text-[#E35824] transition-all flex items-center justify-center gap-2 text-xs font-bold"
                                    >
                                        <Plus size={16} /> Add Breakdown Item
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Save Button */}
                <div className="bg-neutral-800/80 p-6 px-7 border-t border-neutral-700/50 shrink-0">
                    <button 
                        onClick={handleSave} 
                        disabled={(actionTemplate === 'standard' && !title.trim()) || isSaving || isSuccess}
                        className={clsx(
                            "w-full font-bold p-4 rounded-[1.5rem] flex items-center justify-center gap-3 transition-all duration-300 shadow-xl active:scale-[0.98]",
                            isSuccess 
                                ? "bg-green-600 text-white shadow-green-900/20" 
                                : "bg-[#E35824] hover:bg-[#E35824]/90 disabled:opacity-50 text-white shadow-[#E35824]/20"
                        )}
                    >
                        {isSuccess ? (
                            <>
                                {actionTemplate === 'prayer_routine' ? '5 Prayers Activated & Synced' : 'Saved Successfully'} 
                                <Check size={20} strokeWidth={3} />
                            </>
                        ) : (
                            <>
                                {isSaving 
                                    ? (actionTemplate === 'prayer_routine' ? "Activating 5 Prayers..." : "Saving...") 
                                    : (actionTemplate === 'prayer_routine' ? "Activate 5 Daily Prayers" : "Create Task")} 
                                <Save size={18} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
