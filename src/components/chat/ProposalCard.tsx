import { Check, X as XIcon, ExternalLink } from "lucide-react";
import { useState, useMemo } from "react";
import clsx from "clsx";

export interface TaskProposal {
  id?: string;
  title: string;
  dateTime?: string;
  location?: string;
  subtasks?: string[];
}

interface ProposalCardProps {
  tasks: TaskProposal[];
  onAccept: (tasks: TaskProposal[]) => void;
  onRejectAll: () => void;
  onOpenTask?: (id: string) => void;
  initialAcceptedIndices?: number[];
  initialRejectedIndices?: number[];
  onStateChange?: (acceptedIndices: number[], rejectedIndices: number[], updatedTasks: TaskProposal[]) => void;
}

export default function ProposalCard({ 
  tasks = [], 
  onAccept, 
  onRejectAll, 
  onOpenTask,
  initialAcceptedIndices = [],
  initialRejectedIndices = [],
  onStateChange
}: ProposalCardProps) {
  // Ensure every task has a stable ID for linking
  const tasksWithIds = useMemo(() => tasks.map(t => ({
    ...t,
    id: t.id || crypto.randomUUID()
  })), [tasks]);

  const [acceptedIndices, setAcceptedIndices] = useState<number[]>(initialAcceptedIndices);
  const [rejectedIndices, setRejectedIndices] = useState<number[]>(initialRejectedIndices);

  const handleAcceptOne = (index: number) => {
    if (acceptedIndices.includes(index)) return;
    const next = [...acceptedIndices, index];
    setAcceptedIndices(next);
    onAccept([tasksWithIds[index]]);
    onStateChange?.(next, rejectedIndices, tasksWithIds);
  };

  const handleRejectOne = (index: number) => {
    if (rejectedIndices.includes(index)) return;
    const next = [...rejectedIndices, index];
    setRejectedIndices(next);
    onStateChange?.(acceptedIndices, next, tasksWithIds);
  };

  const handleAcceptAll = () => {
    const remainingIndices = tasksWithIds
      .map((_, i) => i)
      .filter(i => !rejectedIndices.includes(i) && !acceptedIndices.includes(i));
    
    if (remainingIndices.length === 0) return;
    
    const next = [...acceptedIndices, ...remainingIndices];
    setAcceptedIndices(next);
    const remainingTasks = remainingIndices.map(i => tasksWithIds[i]);
    onAccept(remainingTasks);
    onStateChange?.(next, rejectedIndices, tasksWithIds);
  };

  if (!tasksWithIds || tasksWithIds.length === 0) return null;

  const pendingTasks = tasksWithIds.filter((_, i) => !acceptedIndices.includes(i) && !rejectedIndices.includes(i));
  const acceptedTasks = tasksWithIds.filter((_, i) => acceptedIndices.includes(i));
  const processedCount = acceptedIndices.length + rejectedIndices.length;
  const allProcessed = processedCount === tasksWithIds.length;

  // Don't show the card at all if all were rejected and none were accepted
  if (allProcessed && acceptedTasks.length === 0) {
    return (
      <div className="py-2 px-4 border-l-2 border-neutral-800 text-neutral-500 text-xs italic">
        Proposals dismissed.
      </div>
    );
  }

  return (
    <div className="my-4 w-full max-w-sm ml-auto mr-auto sm:max-w-md flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2">
      {/* Saved Tasks Section */}
      {acceptedTasks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {acceptedTasks.map((task) => (
            <div 
              key={task.id} 
              onClick={() => task.id && onOpenTask?.(task.id)}
              className="flex items-center gap-3 p-3 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-800/80 cursor-pointer group transition-all"
            >
              <div className="w-6 h-6 rounded-full bg-#e05012/20 text-#e05012 flex items-center justify-center shrink-0">
                <Check size={14} strokeWidth={3} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-neutral-100 group-hover:text-#e05012 transition-colors truncate">
                  {task.title}
                </div>
                {(task.dateTime || task.location) && (
                  <div className="text-[10px] text-neutral-500 mt-0.5 flex gap-2">
                    {task.dateTime && <span>📅 {task.dateTime}</span>}
                    {task.location && <span>📍 {task.location}</span>}
                  </div>
                )}
              </div>
              <ExternalLink size={14} className="text-neutral-700 group-hover:text-#e05012 transition-colors" />
            </div>
          ))}
        </div>
      )}

      {/* Pending Proposals Section */}
      {pendingTasks.length > 0 && (
        <div className="rounded-2xl border border-neutral-700 bg-neutral-900/80 overflow-hidden shadow-xl shadow-[#e05012]/10">
          <div className="bg-neutral-800/50 px-4 py-2.5 border-b border-neutral-700 flex justify-between items-center">
            <h3 className="font-bold text-neutral-300 text-[11px] uppercase tracking-wider">New Action Items</h3>
            <span className="text-[10px] text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded-full">{pendingTasks.length} pending</span>
          </div>
          
          <div className="p-2 flex flex-col gap-2">
            {tasksWithIds.map((task, i) => {
              if (acceptedIndices.includes(i) || rejectedIndices.includes(i)) return null;
              
              return (
                <div key={i} className="p-3 rounded-xl border border-neutral-700 bg-neutral-800/50 hover:bg-neutral-800 transition-colors">
                  <div className="font-medium text-sm text-neutral-100">{task.title}</div>
                  
                  {(task.dateTime || task.location) && (
                    <div className="text-[11px] text-neutral-400 mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                      {task.dateTime && <span className="flex items-center gap-1">📅 {task.dateTime}</span>}
                      {task.location && <span className="flex items-center gap-1">📍 {task.location}</span>}
                    </div>
                  )}
                  
                  {task.subtasks && task.subtasks.length > 0 && (
                    <div className="mt-2.5 pt-2 text-[10px] text-neutral-500 border-t border-neutral-700/50 flex items-center gap-2">
                      <div className="flex -space-x-1">
                        {[1, 2, 3].slice(0, Math.min(3, task.subtasks.length)).map(n => (
                          <div key={n} className="w-3 h-3 rounded-full border border-neutral-800 bg-neutral-700" />
                        ))}
                      </div>
                      {task.subtasks.length} suggested subtasks
                    </div>
                  )}
                  
                  <div className="flex gap-2 mt-4">
                    <button 
                      onClick={() => handleAcceptOne(i)} 
                      className="flex-1 py-1.5 rounded-lg bg-[#e05012] hover:bg-[#e05012]/90 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
                    >
                      <Check size={14} strokeWidth={2.5} /> Accept
                    </button>
                    <button 
                      onClick={() => handleRejectOne(i)} 
                      className="flex-1 py-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-300 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <XIcon size={14} /> Skip
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {pendingTasks.length > 1 && (
            <div className="p-3 border-t border-neutral-700 flex gap-2">
              <button 
                onClick={handleAcceptAll} 
                className="flex-1 bg-[#e05012]/20 hover:bg-[#e05012]/30 text-[#e05012] border border-[#e05012]/30 rounded-lg py-2 text-[11px] font-bold transition-all"
              >
                Accept All {pendingTasks.length}
              </button>
              <button 
                onClick={onRejectAll} 
                className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded-lg py-2 text-[11px] font-bold transition-all"
              >
                Dismiss All
              </button>
            </div>
          )}
        </div>
      )}

      {/* Completed State Indicator */}
      {allProcessed && acceptedTasks.length > 0 && (
        <div className="pt-2 flex items-center justify-center gap-2 opacity-40">
          <div className="h-px bg-neutral-800 flex-1" />
          <div className="flex items-center gap-1.5">
            <Check size={12} className="text-#e05012" />
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter">Tasks Synced</span>
          </div>
          <div className="h-px bg-neutral-800 flex-1" />
        </div>
      )}
    </div>
  );
}
