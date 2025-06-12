import React from 'react';
import { Message as MessageType } from '../types';
import { UserCircle, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface MessageProps {
  message: MessageType;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={`py-5 ${isUser ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}`}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-start gap-4">
        <div className="flex-shrink-0 mt-1">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-500 dark:text-blue-300">
              <UserCircle size={20} />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-500 dark:text-green-300">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="w-5 h-5"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 prose dark:prose-invert max-w-none whitespace-pre-wrap break-words overflow-hidden overflow-x-hidden overflow-y-auto">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
          >
            {message.content}
          </ReactMarkdown>
          
          {!isUser && message.sources && message.sources.length > 0 && (
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              <div className="font-medium mb-1">Sources:</div>
              {message.sources.map((source, idx) => (
                <div key={idx} className="flex items-center gap-1 mb-1">
                  <FileText size={12} />
                  <span>{source.file_name} ({(source.score * 100).toFixed(1)}%)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Message;