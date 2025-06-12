import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../contexts/ChatContext';
import { Send } from 'lucide-react';

const ChatInput: React.FC = () => {
  const [input, setInput] = useState('');
  const { addMessage, isTyping } = useChat();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isTyping) {
      addMessage(input.trim(), 'user');
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  return (
    <div className="border-t dark:border-gray-700 bg-white dark:bg-gray-800 py-4">
      <div className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="relative px-4 sm:px-6">
          <div className="overflow-hidden rounded-lg border dark:border-gray-700 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
              placeholder="Message BrixAI..."
              className="block w-full resize-none border-0 bg-transparent py-3 px-4 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:ring-0 sm:text-sm sm:leading-6"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className={`absolute right-6 bottom-2.5 rounded-md p-2 
              ${input.trim() && !isTyping 
                ? 'text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700' 
                : 'text-gray-300 dark:text-gray-600'
              } transition-colors`}
          >
            <Send size={20} />
          </button>
        </form>
        <div className="text-xs text-center mt-2 text-gray-500 dark:text-gray-400">
          {isTyping ? 'AI is typing...' : 'BrixAI may produce inaccurate information.'}
        </div>
      </div>
    </div>
  );
};

export default ChatInput;