import React from 'react';
import { X, Plus, MessageSquare, Trash2, Menu } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

// Interface is now provided by ChatContext

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const { startNewChat, loadChat, currentChatId, chatHistories, deleteChat } = useChat();

  // Chat histories are now loaded from Supabase via ChatContext

  // Create a new chat
  const handleNewChat = () => {
    startNewChat();
  };

  // Delete a chat history from Supabase
  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteChat(id);
  };

  // Select a chat history
  const selectChat = (id: string) => {
    // Load the selected chat's messages from Supabase
    loadChat(id);
  };

  return (
    <>
      {/* Menu button - only visible on mobile */}
      <div className="fixed top-4 left-4 z-[85] md:hidden"> 
        <button
          onClick={onToggle}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 shadow-md"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
      </div>

      <div
        className={`fixed left-0 top-[64px] z-[50] w-64 h-[calc(100vh-64px)] bg-gray-100 dark:bg-gray-900 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-all duration-300 ease-in-out shadow-lg md:shadow-none md:static md:translate-x-0 md:h-full md:w-[250px] md:min-w-[200px] md:flex-shrink-0`}
      >
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <button
            onClick={onToggle}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors md:hidden"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>
        
      <div 
      className="flex flex-col h-full overflow-hidden">
      
        <div className="p-4 ">
        <h2 className="font-semibold text-lg">Chat History</h2>
        <div><br></br></div>
          <button 
            onClick={handleNewChat}
            className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm hover:shadow-md"
          >
            <Plus size={16} />
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar">
          {chatHistories.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
              No chat history yet
            </div>
          ) : (
            chatHistories.map((chat) => (
              <div 
                key={chat.id}
                onClick={() => selectChat(chat.id)}
                className={`p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-between ${currentChatId === chat.id ? 'bg-gray-200 dark:bg-gray-800' : ''}`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare size={16} />
                  <span className="truncate">{chat.title}</span>
                </div>
                <button 
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                  className="p-1 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700"
                  aria-label="Delete chat"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      </div>
    </>
  );
};

export default Sidebar;