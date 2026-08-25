import React from 'react';
import { Message } from '@/types/chat';
import { User, Sparkles, Volume2, Square } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
  onSpeak?: (text: string, messageId: string) => void;
  isCurrentlySpeaking?: boolean;
}

export default function ChatMessage({ message, onSpeak, isCurrentlySpeaking }: ChatMessageProps) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex w-full items-start space-x-3 mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-sm">
          <Sparkles className="h-4.5 w-4.5" />
        </div>
      )}
      <div className={`flex flex-col max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-sm ${
            isUser
              ? 'bg-[#4F46E5] text-white rounded-tr-none'
              : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-none'
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className="flex items-center space-x-2 mt-1.5 px-1">
          <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isUser && onSpeak && (
            <button
              onClick={() => onSpeak(message.content, message.id)}
              className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5 rounded cursor-pointer"
              title={isCurrentlySpeaking ? "Stop reading" : "Read aloud"}
            >
              {isCurrentlySpeaking ? (
                <Square className="h-3 w-3 text-indigo-600 animate-pulse fill-indigo-600" />
              ) : (
                <Volume2 className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </div>
      {isUser && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-600 shadow-sm">
          <User className="h-4.5 w-4.5" />
        </div>
      )}
    </div>
  );
}
