import React, { useRef, useEffect } from 'react';
import { useChat } from '../contexts/ChatContext';
import Message from './Message';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';

const ChatContainer: React.FC = () => {
  const { messages, isTyping } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] relative">
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-32">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6">
              <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-2">
                How can I help you today?
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                Ask me anything about ICD10 code, and I'll do my best to assist you.
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
            {isTyping && <TypingIndicator />}
          </>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="absolute bottom-0 left-0 right-0">
        <ChatInput />
      </div>
    </div>
  );
};

export default ChatContainer;