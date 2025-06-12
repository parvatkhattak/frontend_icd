import React, { createContext, useContext, useState, useEffect } from 'react';
import { Message, ChatContextType } from '../types';
import { fetchChatHistory, fetchChatMessages, saveChatMessage, deleteChat as deleteSupabaseChat } from '../utils/supabaseClient';
import { useAuth } from './AuthContext';

// Backend API URLs
const API_BASE_URL = "https://chatbot-vl3b.onrender.com/api";

export const ChatContext = createContext<ChatContextType>({} as ChatContextType);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string>('');
  const [chatHistories, setChatHistories] = useState<Array<{id: string, title: string, timestamp: number}>>([]);
  const { user } = useAuth();

  // Initialize a new chat on component mount
  useEffect(() => {
    const initializeNewChat = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/new-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setCurrentChatId(data.chat_id);
        } else {
          // Fallback to timestamp-based ID
          setCurrentChatId(Date.now().toString());
        }
      } catch (error) {
        console.error('Error creating new chat:', error);
        // Fallback to timestamp-based ID
        setCurrentChatId(Date.now().toString());
      }
    };

    if (!currentChatId) {
      initializeNewChat();
    }
  }, [currentChatId]);

  // Load chat histories from Supabase on component mount or when user changes
  useEffect(() => {
    const loadChatHistories = async () => {
      if (user) {
        const userId = user.user_metadata.user_id;
        const histories = await fetchChatHistory(userId);
        setChatHistories(histories);
      } else {
        setChatHistories([]);
      }
    };
    
    loadChatHistories();
  }, [user]);

  const addMessage = async (content: string, role: 'user' | 'assistant') => {
    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      role,
      timestamp: Date.now(),
    };
    
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    
    if (role === 'user') {
      // Send request to backend API
      setIsTyping(true);
      try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            question: content,
            chat_id: currentChatId,
            user_id: user?.user_metadata.user_id || 'default_user',
            is_new_chat: messages.length === 1 // First user message in this session
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: data.answer,
          role: 'assistant',
          timestamp: Date.now() + 1,
          // sources: data.sources || [],
          structured_query: data.structured_query,
          conversation_context: data.conversation_context,
        };
        
        setMessages((prevMessages) => [...prevMessages, aiResponse]);
        
        // The backend now handles saving to Supabase automatically
        // Update chat histories after the conversation is saved
        if (user) {
          setTimeout(async () => {
            const histories = await fetchChatHistory(user.user_metadata.user_id);
            setChatHistories(histories);
          }, 500); // Small delay to ensure backend has saved
        }
      } catch (error) {
        console.error('Error fetching response:', error);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: 'Sorry, there was an error connecting to the server. Please try again.',
          role: 'assistant',
          timestamp: Date.now() + 1,
        };
        setMessages((prevMessages) => [...prevMessages, errorMessage]);
      } finally {
        setIsTyping(false);
      }
    }
  };

  const startNewChat = async () => {
    setMessages([]);
    
    try {
      const response = await fetch(`${API_BASE_URL}/new-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentChatId(data.chat_id);
      } else {
        // Fallback to timestamp-based ID
        setCurrentChatId(Date.now().toString());
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
      // Fallback to timestamp-based ID
      setCurrentChatId(Date.now().toString());
    }
  };
  
  const loadChat = async (chatId: string) => {
    try {
      if (!user) return;
      
      // Use the backend API to get chat history
      const response = await fetch(`${API_BASE_URL}/chat-history/${chatId}?user_id=${user.user_metadata.user_id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.history && data.history.length > 0) {
          // Convert API response to Message format
          const formattedMessages: Message[] = data.history.map((msg: any, index: number) => ({
            id: `${chatId}-${index}`,
            content: msg.content,
            role: msg.role,
            timestamp: Date.now() + index
          }));
          
          setMessages(formattedMessages);
          setCurrentChatId(chatId);
        }
      } else {
        console.error('Failed to load chat history from API');
        
        // Fallback to direct Supabase call
        const chatMessages = await fetchChatMessages(chatId, user.user_metadata.user_id);
        if (chatMessages.length > 0) {
          const formattedMessages: Message[] = [];
          
          chatMessages.forEach(record => {
            formattedMessages.push({
              id: `${record.id}-user`,
              content: record.user_message,
              role: 'user',
              timestamp: new Date(record.created_at).getTime()
            });
            
            formattedMessages.push({
              id: `${record.id}-assistant`,
              content: record.ai_message,
              role: 'assistant',
              timestamp: new Date(record.created_at).getTime() + 1
            });
          });
          
          setMessages(formattedMessages);
          setCurrentChatId(chatId);
        }
      }
    } catch (error) {
      console.error('Error loading chat:', error);
      
      // Fallback to direct Supabase call
      try {
        const chatMessages = await fetchChatMessages(chatId, user.user_metadata.user_id);
        if (chatMessages.length > 0) {
          const formattedMessages: Message[] = [];
          
          chatMessages.forEach(record => {
            formattedMessages.push({
              id: `${record.id}-user`,
              content: record.user_message,
              role: 'user',
              timestamp: new Date(record.created_at).getTime()
            });
            
            formattedMessages.push({
              id: `${record.id}-assistant`,
              content: record.ai_message,
              role: 'assistant',
              timestamp: new Date(record.created_at).getTime() + 1
            });
          });
          
          setMessages(formattedMessages);
          setCurrentChatId(chatId);
        }
      } catch (fallbackError) {
        console.error('Fallback chat loading also failed:', fallbackError);
      }
    }
  };

  // Delete a chat from Supabase and update local state
  const deleteChat = async (chatId: string) => {
    try {
      if (!user) return;
      
      // Delete from Supabase
      const success = await deleteSupabaseChat(chatId, user.user_metadata.user_id);
      
      if (success) {
        // Update local state
        setChatHistories(prevHistories => 
          prevHistories.filter(chat => chat.id !== chatId)
        );
        
        // If the deleted chat was the current one, start a new chat
        if (currentChatId === chatId) {
          await startNewChat();
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  return (
    <ChatContext.Provider value={{ 
      messages, 
      addMessage, 
      isTyping, 
      startNewChat, 
      loadChat, 
      currentChatId,
      chatHistories,
      deleteChat
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);