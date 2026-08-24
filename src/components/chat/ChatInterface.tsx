'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Message, ChatResponse } from '@/types/chat';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import { Sparkles, MessageSquare, AlertCircle, Plus, Search, Folder, ClipboardList, FileText, History, Settings, Menu, X } from 'lucide-react';

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(7);
};

const getCurrentTimestamp = (): string => new Date().toISOString();

const quickPromptMap: Record<string, string> = {
  'Create image': 'Help me create an image description.',
  'Analyze code': 'Help me analyze some code.',
  'Summarize text': 'Help me summarize this text.',
  'Make a plan': 'Help me make a project plan.',
  'Surprise me': 'Surprise me with a unique AI insight.',
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversationsList, setConversationsList] = useState<Array<{ id: string; title: string; updated_at: string }>>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversationsList(data);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  };

  const fetchHistory = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat?conversationId=${id}`);
      if (!response.ok) {
        throw new Error('Failed to retrieve message history');
      }
      const data = await response.json();
      setMessages(data);
    } catch (err: unknown) {
      console.error(err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg || 'Failed to load conversation history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const savedId = localStorage.getItem('aura_current_conversation_id');
    setTimeout(() => {
      if (savedId) {
        setCurrentConversationId(savedId);
        fetchHistory(savedId);
      }
      fetchConversations();
    }, 0);
  }, []);

  const handleSelectConversation = (id: string) => {
    if (id === currentConversationId) return;
    setCurrentConversationId(id);
    localStorage.setItem('aura_current_conversation_id', id);
    fetchHistory(id);
    setIsSidebarOpen(false); // Close mobile drawer
  };

  const handleSendMessage = async (content: string) => {
    setError(null);
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      createdAt: getCurrentTimestamp(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          conversationId: currentConversationId || undefined,
        }),
      });

      if (!response.ok) {
        let errMessage = 'Failed to generate response';
        try {
          const errData = await response.json();
          errMessage = errData.error || errMessage;
        } catch {}
        throw new Error(errMessage);
      }

      const data: ChatResponse & { conversationId: string } = await response.json();
      
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: data.message,
        createdAt: getCurrentTimestamp(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      if (!currentConversationId && data.conversationId) {
        setCurrentConversationId(data.conversationId);
        localStorage.setItem('aura_current_conversation_id', data.conversationId);
      }
      
      fetchConversations();
    } catch (err: unknown) {
      console.error(err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg || 'An unexpected error occurred. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPromptClick = (prompt: string) => {
    const content = quickPromptMap[prompt] || prompt;
    handleSendMessage(content);
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    setCurrentConversationId(null);
    localStorage.removeItem('aura_current_conversation_id');
  };

  return (
    <div className="w-full h-screen bg-[#F3F4F6] p-0 md:p-4 flex items-center justify-center overflow-hidden">
      <div className="w-full h-full bg-white rounded-none md:rounded-2xl border-none md:border border-slate-200/80 shadow-md flex overflow-hidden relative">
        
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/30 z-30 md:hidden backdrop-blur-xs"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 w-[260px] bg-[#FAFAFA] border-r border-slate-200/60 z-40 flex flex-col transition-transform duration-300 md:static md:translate-x-0 shrink-0 h-full ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {/* Sidebar Header: Aura Branding */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="relative flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white shadow-sm shadow-indigo-500/10">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <div>
                <h1 className="text-[14px] font-bold text-slate-800 leading-none">Aura</h1>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Personal Assistant</p>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search Box */}
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search" 
                disabled
                className="w-full pl-9 pr-4 py-1.5 bg-slate-100/80 border border-slate-200/50 rounded-xl text-slate-700 placeholder-slate-400 text-xs font-medium cursor-not-allowed select-none focus:outline-none"
              />
            </div>
          </div>

          {/* Sidebar Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1.5 flex flex-col min-h-0">
            <div className="space-y-1.5 shrink-0">
              {[
                { id: 'chats', label: 'Chats', icon: MessageSquare, active: true },
                { id: 'projects', label: 'Projects', icon: Folder, active: false },
                { id: 'templates', label: 'Templates', icon: ClipboardList, active: false },
                { id: 'documents', label: 'Documents', icon: FileText, active: false },
                { id: 'history', label: 'History', icon: History, active: false },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    disabled={!item.active}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                      item.active 
                        ? 'bg-indigo-50/70 text-indigo-600' 
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-not-allowed select-none'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${item.active ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Chat History Section */}
            <div className="pt-4 px-3 flex-1 overflow-hidden flex flex-col min-h-0">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block mb-2 shrink-0 select-none">Chat history</span>
              <div className="space-y-1 overflow-y-auto flex-1 pr-1">
                {conversationsList.length === 0 ? (
                  <span className="text-[10px] text-slate-400 italic px-2 block py-1.5 select-none">No past sessions</span>
                ) : (
                  conversationsList.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-all truncate block ${
                        conv.id === currentConversationId
                          ? 'bg-indigo-50/70 text-indigo-600 font-semibold'
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer'
                      }`}
                      title={conv.title}
                    >
                      {conv.title}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat List Section */}
            <div className="pt-4 px-3 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block mb-2 select-none">Chat list</span>
              <div className="space-y-1">
                {[
                  { label: 'Favorites', dotColor: 'bg-emerald-400' },
                  { label: 'Code', dotColor: 'bg-amber-400' },
                  { label: 'Marketing', dotColor: 'bg-emerald-400' },
                  { label: 'Archived', dotColor: 'bg-rose-400' },
                ].map((cat) => (
                  <div key={cat.label} className="flex items-center justify-between px-2 py-1.5 text-xs text-slate-500 select-none">
                    <div className="flex items-center space-x-2.5">
                      <span className={`h-2 w-2 rounded-full ${cat.dotColor}`} />
                      <span className="font-medium">{cat.label}</span>
                    </div>
                  </div>
                ))}
                <button type="button" className="w-full flex items-center space-x-2 px-2 py-2 text-xs text-slate-400 hover:text-indigo-600 transition-colors mt-1 font-medium cursor-pointer" aria-label="Add new list">
                  <Plus className="h-3.5 w-3.5" />
                  <span>New list</span>
                </button>
              </div>
            </div>
          </nav>

          {/* User Profile Footer */}
          <div className="p-4 border-t border-slate-100 bg-[#FAFAFA]/50 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3 select-none">
              <div className="h-8.5 w-8.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                P
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 leading-none">Prakash</p>
                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Personal Assistant</p>
              </div>
            </div>
            <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col h-full bg-[#F9FAFB] relative overflow-hidden">
          
          {/* Main Top Header */}
          <header className="h-14 border-b border-slate-155 bg-white flex items-center justify-between px-6 shrink-0 sticky top-0 z-10">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                aria-label="Toggle sidebar"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
              <h2 className="text-xs font-bold text-slate-700 tracking-wide uppercase select-none">
                {currentConversationId 
                  ? (conversationsList.find(c => c.id === currentConversationId)?.title || "Active chat")
                  : "New chat"
                }
              </h2>
            </div>
            
            <button
              onClick={clearChat}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-100/60 rounded-xl transition-all cursor-pointer font-semibold animate-fade-in"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New chat</span>
            </button>
          </header>

          {/* Chat / Welcome Workspace Content */}
          <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 max-w-4xl mx-auto w-full flex flex-col">
            {messages.length === 0 ? (
              // Centered Welcome Layout
              <div className="flex-1 flex flex-col justify-center items-center text-center my-auto px-4 py-8">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-5 shadow-sm animate-pulse">
                  <Sparkles className="h-6 w-6" />
                </div>
                
                <h2 className="text-2xl font-black tracking-tight text-slate-800 md:text-3xl mb-2">
                  Hello Prakash 👋
                </h2>
                <p className="text-xs text-slate-400 font-semibold max-w-sm mb-6 leading-relaxed">
                  Ask anything, explore possibilities, and get instant insights.
                </p>

                {/* Card Composer */}
                <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} isWelcome={true} />

                {/* Quick Prompts */}
                <div className="mt-8 w-full max-w-xl">
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block mb-3 select-none">Choose a quick prompt</span>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      "Create image",
                      "Analyze code",
                      "Summarize text",
                      "Make a plan",
                      "Surprise me"
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleQuickPromptClick(prompt)}
                        className="px-3.5 py-1.5 text-xs bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all duration-200 shadow-xs cursor-pointer font-medium"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // Active Message Threads
              <div className="flex-grow">
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                
                {isLoading && (
                  <div className="flex w-full items-start space-x-3 mb-6 justify-start animate-pulse">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-sm">
                      <Sparkles className="h-4.5 w-4.5" />
                    </div>
                    <TypingIndicator />
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </main>

          {/* Sticky Composer for Active Chats */}
          {messages.length > 0 && (
            <footer className="border-t border-slate-200/60 bg-white/80 backdrop-blur-md px-4 py-4 md:px-8 sticky bottom-0 z-10">
              <div className="max-w-3xl mx-auto w-full flex flex-col space-y-3">
                {error && (
                  <div className="flex items-center space-x-2 p-2.5 text-xs bg-rose-50 border border-rose-100 text-rose-600 rounded-xl">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p className="flex-1 font-medium">{error}</p>
                  </div>
                )}
                
                <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} isWelcome={false} />
                
                <p className="text-[9px] text-center text-slate-400 font-semibold select-none">
                  Aura can make mistakes. Verify important information.
                </p>
              </div>
            </footer>
          )}
        </div>

      </div>
    </div>
  );
}
