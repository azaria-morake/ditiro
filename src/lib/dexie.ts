import Dexie, { Table } from 'dexie';

export interface Chat {
  id: string;
  title: string;
  emoji: string;
  timeIndicator: string;
  createdAt: number;
  updatedAt: number;
  userId: string | null;
}

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'proposal';
  proposalData?: {
    tasks: Array<{
      id?: string;
      title: string;
      dateTime?: string;
      location?: string;
      subtasks?: string[];
    }>;
    acceptedIndices?: number[];
    rejectedIndices?: number[];
  };
  timestamp: number;
}

export interface Task {
  id: string;
  chatId: string;
  title: string;
  description?: string;
  status: 'active' | 'completed';
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
  dueTime?: string;
  location?: string;
  createdAt: number;
  updatedAt: number;
  userId: string | null;
}

export interface Subtask {
  id: string;
  taskId: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  dueTime?: string;
  order: number;
}

export class DitiroDatabase extends Dexie {
  chats!: Table<Chat>;
  messages!: Table<Message>;
  tasks!: Table<Task>;
  subtasks!: Table<Subtask>;

  constructor() {
    super('DitiroDB');
    this.version(1).stores({
      chats: 'id, userId, updatedAt',
      messages: 'id, chatId, timestamp',
      tasks: 'id, chatId, userId, status',
      subtasks: 'id, taskId, completed'
    });
  }
}

export const db = new DitiroDatabase();
