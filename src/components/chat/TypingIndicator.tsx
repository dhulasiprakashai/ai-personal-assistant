import React from 'react';

export default function TypingIndicator() {
  return (
    <div className="flex items-center space-x-1.5 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 max-w-[70px] justify-center shadow-sm">
      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-blink" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-blink" style={{ animationDelay: '200ms' }} />
      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-blink" style={{ animationDelay: '400ms' }} />
    </div>
  );
}
