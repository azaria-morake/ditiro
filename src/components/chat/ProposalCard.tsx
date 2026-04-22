"use client";

import { Check, X as XIcon } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

export interface TaskProposal {
  title: string;
  dateTime?: string;
  location?: string;
  subtasks?: string[];
}

interface ProposalCardProps {
  tasks: TaskProposal[];
  onAccept: (tasks: TaskProposal[]) => void;
  onRejectAll: () => void;
}

export default function ProposalCard({ tasks, onAccept, onRejectAll }: ProposalCardProps) {
  const [acceptedIndices, setAcceptedIndices] = useState<number[]>([]);
  const [rejectedIndices, setRejectedIndices] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const handleAcceptOne = (index: number) => {
    setAcceptedIndices(prev => [...prev, index]);
  };

  const handleRejectOne = (index: number) => {
    setRejectedIndices(prev => [...prev, index]);
  };

  const handleAcceptAll = () => {
    const acceptedTasks = tasks.map((_, i) => i).filter(i => !rejectedIndices.includes(i));
    handleFinalize(acceptedTasks);
  };

  const handleFinalize = (acceptedArr: number[]) => {
      setSubmitted(true);
      const finalTasks = tasks.filter((_, i) => acceptedArr.includes(i));
      onAccept(finalTasks);
  };

  if (submitted) {
    return (
      <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900 shadow-md">
        <p className="text-sm text-emerald-400 flex items-center gap-2">
            <Check size={16} /> Saved to Task Manager
        </p>
      </div>
    );
  }

  const allRejected = rejectedIndices.length === tasks.length;

  if (allRejected) {
    return null;
  }

  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-900 overflow-hidden shadow-lg w-full max-w-sm ml-auto mr-auto my-4 sm:max-w-md shadow-emerald-900/10">
      <div className="bg-neutral-800 p-3 border-b border-neutral-700">
        <h3 className="font-semibold text-neutral-200 text-sm">Proposed Tasks</h3>
      </div>
      <div className="p-2 flex flex-col gap-2">
        {tasks.map((task, i) => {
          if (rejectedIndices.includes(i)) return null;
          const isAccepted = acceptedIndices.includes(i);
          return (
            <div key={i} className={clsx(
                "p-3 rounded-lg border transition-colors",
                isAccepted ? "border-emerald-500/50 bg-emerald-500/10" : "border-neutral-700 bg-neutral-800"
            )}>
              <div className="font-medium text-sm text-neutral-100">{task.title}</div>
              {(task.dateTime || task.location) && (
                  <div className="text-xs text-neutral-400 mt-1 flex flex-wrap gap-2">
                      {task.dateTime && <span>📅 {task.dateTime}</span>}
                      {task.location && <span>📍 {task.location}</span>}
                  </div>
              )}
              {task.subtasks && task.subtasks.length > 0 && (
                  <div className="mt-2 text-xs text-neutral-500 pl-4 border-l border-neutral-700">
                      {task.subtasks.length} subtask(s) suggested
                  </div>
              )}
              {!isAccepted && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleAcceptOne(i)} className="flex-1 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors">
                      <Check size={14} /> Accept
                  </button>
                  <button onClick={() => handleRejectOne(i)} className="flex-1 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1 transition-colors">
                      <XIcon size={14} /> Reject
                  </button>
                </div>
              )}
              {isAccepted && (
                  <div className="mt-2 text-xs font-semibold text-emerald-500 flex items-center gap-1">
                      <Check size={14} /> Accepted
                  </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="p-3 border-t border-neutral-700 bg-neutral-800/50 flex gap-2">
          <button onClick={handleAcceptAll} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2 text-sm font-semibold transition-colors shadow-sm">
              Accept {acceptedIndices.length === 0 ? "All" : "Remaining"}
          </button>
          <button onClick={onRejectAll} className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg py-2 text-sm font-semibold transition-colors shadow-sm">
              Reject All
          </button>
      </div>
    </div>
  );
}
