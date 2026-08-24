import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Settings, Paperclip, Mic, BookOpen, Send } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isWelcome: boolean;
}

export default function ChatInput({ onSendMessage, isLoading, isWelcome }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to compute actual scrollHeight
    textarea.style.height = 'auto';
    const minHeight = isWelcome ? 72 : 24;
    textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
  }, [input, isWelcome]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    onSendMessage(trimmedInput);
    setInput('');
    
    // Reset height and refocus
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If Enter (and not Shift+Enter) is pressed, submit the form
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isDisabled = isLoading || !input.trim();

  if (isWelcome) {
    return (
      <form onSubmit={handleSubmit} className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col mt-6">
        {/* Top card bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold select-none">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            <span>Start new chat</span>
          </div>
          <button type="button" className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer" aria-label="Settings">
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Text Input area */}
        <div className="p-4 flex-1">
          <textarea
            ref={textareaRef}
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="How can I help you today?"
            disabled={isLoading}
            className="w-full resize-none border-none text-slate-800 placeholder-slate-400/80 text-sm focus:outline-none focus:ring-0 p-0"
            aria-label="Message input"
          />
        </div>

        {/* Bottom Action bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-150">
          {/* Left icons (placeholders) */}
          <div className="flex items-center space-x-4">
            <button type="button" className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium cursor-pointer" aria-label="Attach file">
              <Paperclip className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">Attach</span>
            </button>
            <button type="button" className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium cursor-pointer" aria-label="Voice input">
              <Mic className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">Voice</span>
            </button>
            <button type="button" className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium cursor-pointer" aria-label="Prompt library">
              <BookOpen className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">Prompt library</span>
            </button>
          </div>

          {/* Send button */}
          <button
            type="submit"
            disabled={isDisabled}
            className={`flex h-8 px-4 items-center justify-center rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
              isDisabled
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm hover:shadow active:scale-95'
            }`}
          >
            <span>Send</span>
          </button>
        </div>
      </form>
    );
  }

  // Active Chat compact composer layout
  return (
    <form onSubmit={handleSubmit} className="w-full bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {/* Input field */}
      <div className="px-4 py-3 flex-1 flex items-end space-x-3">
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Aura anything..."
          disabled={isLoading}
          className="w-full resize-none border-none text-slate-800 placeholder-slate-400/80 text-sm focus:outline-none focus:ring-0 p-0 max-h-[140px] overflow-y-auto"
          aria-label="Message input"
        />
      </div>

      {/* Action bar (compact bottom) */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-150">
        <div className="flex items-center space-x-3.5">
          <button type="button" className="text-slate-400 hover:text-slate-600 p-0.5 rounded-lg transition-colors cursor-pointer" title="Attach file" aria-label="Attach file">
            <Paperclip className="h-4 w-4" />
          </button>
          <button type="button" className="text-slate-400 hover:text-slate-600 p-0.5 rounded-lg transition-colors cursor-pointer" title="Voice input" aria-label="Voice input">
            <Mic className="h-4 w-4" />
          </button>
          <button type="button" className="text-slate-400 hover:text-slate-600 p-0.5 rounded-lg transition-colors cursor-pointer" title="Prompt library" aria-label="Prompt library">
            <BookOpen className="h-4 w-4" />
          </button>
        </div>

        <button
          type="submit"
          disabled={isDisabled}
          className={`flex h-7 px-3.5 items-center justify-center rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
            isDisabled
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm active:scale-95'
          }`}
        >
          <Send className="h-3 w-3 sm:hidden" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </form>
  );
}
