import React, { createContext, useContext, useState, useEffect } from 'react';
import { Message, ChatContextType } from '../types';
import { fetchChatHistory, fetchChatMessages, saveChatMessage, deleteChat as deleteSupabaseChat } from '../utils/supabaseClient';
import { useAuth } from './AuthContext';

// Backend API URL
const API_URL = "https://chatbot-vl3b.onrender.com/api/chat";

export const ChatContext = createContext<ChatContextType>({} as ChatContextType);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string>(() => {
    // Generate a new chat ID on initial load
    return Date.now().toString();
  });
  const [chatHistories, setChatHistories] = useState<Array<{id: string, title: string, timestamp: number}>>([]);
  const { user } = useAuth();

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
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            question: content,
            chat_id: currentChatId,
            user_id: user?.user_metadata.user_id || 'guest'
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
          sources: data.sources || [],
        };
        
        setMessages((prevMessages) => [...prevMessages, aiResponse]);
        
        // Save conversation to Supabase if user is logged in
        if (user) {
          await saveChatMessage(
            user.user_metadata.user_id,
            currentChatId,
            content,
            data.answer
          );
          
          // Update chat histories after saving
          const histories = await fetchChatHistory(user.user_metadata.user_id);
          setChatHistories(histories);
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

  const startNewChat = () => {
    setMessages([]);
    setCurrentChatId(Date.now().toString());
  };
  
  const loadChat = async (chatId: string) => {
    try {
      if (!user) return;
      
      const chatMessages = await fetchChatMessages(chatId, user.user_metadata.user_id);
      if (chatMessages.length > 0) {
        // Convert Supabase records to Message format
        const formattedMessages: Message[] = [];
        
        chatMessages.forEach(record => {
          // Add user message
          formattedMessages.push({
            id: `${record.id}-user`,
            content: record.user_message,
            role: 'user',
            timestamp: new Date(record.created_at).getTime()
          });
          
          // Add AI message
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
    } catch (error) {
      console.error('Error loading chat:', error);
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
          startNewChat();
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
