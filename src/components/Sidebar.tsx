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
      {/* Menu button - responsive positioning */}
      <div className="fixed top-[80px] left-4 z-[85] sm:top-[84px] md:hidden lg:top-[88px] xl:top-[92px]"> 
        <button
          onClick={onToggle}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 shadow-md transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
      </div>

      <div
        className={`fixed left-0 top-0 z-[50] w-64 sm:w-72 lg:w-80 h-screen bg-gray-100 dark:bg-gray-900 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-all duration-300 ease-in-out shadow-lg md:shadow-none md:static md:translate-x-0 md:h-full md:w-[250px] lg:w-[280px] xl:w-[320px] md:min-w-[200px] md:flex-shrink-0`}
      >
        <div className="flex items-center justify-between p-3 sm:p-4 lg:p-5 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800 pt-16 sm:pt-20 md:pt-4 lg:pt-5 xl:pt-6">
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
      
        <div className="p-3 sm:p-4 lg:p-5 xl:p-6">
        <h2 className="font-semibold text-base sm:text-lg lg:text-xl">Chat History</h2>
        <div className="mt-3 sm:mt-4"></div>
          <button 
            onClick={handleNewChat}
            className="w-full py-2.5 sm:py-3 lg:py-3.5 px-3 sm:px-4 lg:px-5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm hover:shadow-md text-sm sm:text-base"
          >
            <Plus size={16} className="sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 lg:px-5 xl:px-6 space-y-1.5 sm:space-y-2 custom-scrollbar">
          {chatHistories.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-3 sm:py-4 lg:py-6 text-sm sm:text-base">
              No chat history yet
            </div>
          ) : (
            chatHistories.map((chat) => (
              <div 
                key={chat.id}
                onClick={() => selectChat(chat.id)}
                className={`p-2 sm:p-2.5 lg:p-3 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-between transition-colors ${currentChatId === chat.id ? 'bg-gray-200 dark:bg-gray-800' : ''}`}
              >
                <div className="flex items-center gap-2 sm:gap-2.5 lg:gap-3 truncate min-w-0">
                  <MessageSquare size={14} className="sm:w-4 sm:h-4 lg:w-5 lg:h-5 flex-shrink-0" />
                  <span className="truncate text-sm sm:text-base lg:text-base">{chat.title}</span>
                </div>
                <button 
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                  className="p-1 sm:p-1.5 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors flex-shrink-0 ml-2"
                  aria-label="Delete chat"
                >
                  <Trash2 size={12} className="sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4" />
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
