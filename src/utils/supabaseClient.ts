import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ilnnwhsktxtuwhkcbaup.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlsbm53aHNrdHh0dXdoa2NiYXVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MDkwMDEsImV4cCI6MjA2MTM4NTAwMX0.tL6-RiUQJykGwzss_mZ5-LUB6XbqeTu4ihs89jd7OKs';
const supabaseTableName = import.meta.env.VITE_SUPABASE_TABLE_NAME || 'chathistory';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Table name for chat history
export const CHAT_HISTORY_TABLE = supabaseTableName;

// Default user ID (for single user implementation)
export const DEFAULT_USER_ID = 'default_user';

// Interface for chat history records
export interface ChatHistoryRecord {
  id?: number;
  user_id: string;
  chat_id: string;
  user_message: string;
  ai_message: string;
  created_at?: string;
}

// Function to fetch chat history for a user
export const fetchChatHistory = async (userId: string = DEFAULT_USER_ID) => {
  const { data, error } = await supabase
    .from(CHAT_HISTORY_TABLE)
    .select('chat_id, user_message, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching chat history:', error);
    return [];
  }
  
  // Group by chat_id to get unique chats
  const chatGroups = data.reduce((acc: Record<string, any>, curr) => {
    if (!acc[curr.chat_id]) {
      acc[curr.chat_id] = {
        id: curr.chat_id,
        title: curr.user_message.substring(0, 30) + (curr.user_message.length > 30 ? '...' : ''),
        timestamp: new Date(curr.created_at).getTime()
      };
    }
    return acc;
  }, {});
  
  return Object.values(chatGroups);
};

// Function to fetch messages for a specific chat
export const fetchChatMessages = async (chatId: string, userId: string = DEFAULT_USER_ID) => {
  const { data, error } = await supabase
    .from(CHAT_HISTORY_TABLE)
    .select('*')
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching chat messages:', error);
    return [];
  }
  
  return data;
};

// Function to save a message pair to Supabase
export const saveChatMessage = async (
  userId: string = DEFAULT_USER_ID,
  chatId: string,
  userMessage: string,
  aiMessage: string
) => {
  const { error } = await supabase.from(CHAT_HISTORY_TABLE).insert({
    user_id: userId,
    chat_id: chatId,
    user_message: userMessage,
    ai_message: aiMessage
  });
  
  if (error) {
    console.error('Error saving chat message:', error);
    return false;
  }
  
  return true;
};

// Function to delete a chat and all its messages from Supabase
export const deleteChat = async (chatId: string, userId: string = DEFAULT_USER_ID) => {
  const { error } = await supabase
    .from(CHAT_HISTORY_TABLE)
    .delete()
    .match({ chat_id: chatId, user_id: userId });
  
  if (error) {
    console.error('Error deleting chat:', error);
    return false;
  }
  
  return true;
};