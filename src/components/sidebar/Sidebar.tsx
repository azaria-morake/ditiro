"use client";

import { useAppStore } from "@/store";
import { MessageSquare, CheckSquare, X, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/dexie";
import { useRouter } from "next/navigation";

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen, activeChatId, setActiveChatId } = useAppStore();
  const [activeTab, setActiveTab] = useState<'chats' | 'tasks'>('chats');
  const router = useRouter();

  const chats = useLiveQuery(() => db.chats.toArray().then(arr => arr.sort((a,b) => b.updatedAt - a.updatedAt)));
  const tasks = useLiveQuery(() => db.tasks.toArray().then(arr => arr.sort((a,b) => b.updatedAt - a.updatedAt)));

  const handleDeleteChat = async (id: string) => {
    if (confirm("Delete this chat and all its tasks?")) {
      await db.chats.delete(id);
      await db.messages.where('chatId').equals(id).delete();
      const chatTasks = await db.tasks.where('chatId').equals(id).toArray();
      const taskIds = chatTasks.map(t => t.id);
      await db.tasks.bulkDelete(taskIds);
      await db.subtasks.where('taskId').anyOf(taskIds).delete();
      if(activeChatId === id) {
          setActiveChatId(null);
          router.push('/');
      }
    }
  };

  const handleDeleteTask = async (id: string) => {
      if (confirm("Delete this task?")) {
          await db.tasks.delete(id);
          await db.subtasks.where('taskId').equals(id).delete();
      }
  };

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-72 bg-neutral-900 border-r border-neutral-800 text-white transition-transform duration-300 md:static md:translate-x-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-neutral-800">
          <h1 className="text-xl font-bold tracking-wider">Ditiro</h1>
          <button className="md:hidden p-2" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="flex p-2 gap-2 border-b border-neutral-800">
          <button
            onClick={() => setActiveTab('chats')}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded font-medium text-sm transition-colors",
              activeTab === 'chats' ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"
            )}
          >
            <MessageSquare size={16} /> Chats
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded font-medium text-sm transition-colors",
              activeTab === 'tasks' ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"
            )}
          >
            <CheckSquare size={16} /> Tasks
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {activeTab === 'chats' && (
            <>
              <button 
                onClick={() => { setActiveChatId(null); router.push('/'); setSidebarOpen(false); }}
                className="w-full text-center p-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors font-medium mb-2 text-sm"
              >
                + New Conversation
              </button>
              
              {chats?.map(chat => (
                <div key={chat.id} className={clsx(
                    "group flex items-center justify-between p-3 flex-shrink-0 rounded-lg border transition-colors cursor-pointer text-sm mb-1",
                    activeChatId === chat.id ? "bg-neutral-800 border-emerald-500" : "bg-neutral-900 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800"
                )} onClick={() => { setActiveChatId(chat.id); router.push('/?c=' + chat.id); setSidebarOpen(false); }}>
                  <div className="truncate pr-2 w-full flex items-center">
                      <span className="mr-2 text-lg">{chat.emoji || '💬'}</span>
                      <span className="truncate">{chat.title || 'Draft'}</span> 
                      {chat.timeIndicator && <span className="opacity-50 ml-1 shrink-0">[{chat.timeIndicator}]</span>}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400">
                      <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {chats?.length === 0 && <div className="text-center text-neutral-500 text-sm mt-4">No chats yet</div>}
            </>
          )}

          {activeTab === 'tasks' && (
            <>
              {tasks?.map(task => (
                 <div key={task.id} className="group flex items-start justify-between p-3 flex-shrink-0 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800 transition-colors text-sm mb-1 cursor-pointer"
                      onClick={() => { router.push('/?t=' + task.id); setSidebarOpen(false); }}>
                 <div className="overflow-hidden">
                     <div className="font-medium truncate">{task.title}</div>
                     <div className="text-xs text-neutral-400 mt-1 flex gap-2">
                         {task.dueDate && <span>{task.dueDate} {task.dueTime}</span>}
                     </div>
                 </div>
                 <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 flex-shrink-0 ml-2">
                     <Trash2 size={14} />
                 </button>
               </div>
              ))}
              {tasks?.length === 0 && <div className="text-center text-neutral-500 text-sm mt-4">No active tasks</div>}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
