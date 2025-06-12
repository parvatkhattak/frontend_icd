export interface Source {
  file_name: string;
  source: string;
  score: number;
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
  sources?: Source[];
}

export interface ChatContextType {
  messages: Message[];
  addMessage: (content: string, role: 'user' | 'assistant') => void;
  isTyping: boolean;
  startNewChat: () => void;
  loadChat: (chatId: string) => Promise<void>;
  currentChatId: string;
  chatHistories: Array<{id: string, title: string, timestamp: number}>;
  deleteChat: (chatId: string) => Promise<void>;
}