import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Settings, Paperclip, Mic, BookOpen, Send, Headphones, AlertCircle } from 'lucide-react';

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isWelcome: boolean;
  isContinuousActive: boolean;
  setIsContinuousActive: (active: boolean) => void;
  voiceState: 'off' | 'listening' | 'thinking' | 'speaking';
  setVoiceState: (state: 'off' | 'listening' | 'thinking' | 'speaking') => void;
}

export default function ChatInput({
  onSendMessage,
  isLoading,
  isWelcome,
  isContinuousActive,
  setIsContinuousActive,
  voiceState,
  setVoiceState
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState('en-US');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isRecognitionActiveRef = useRef(false);
  const isStoppingRef = useRef(false);
  const hasLoggedErrorRef = useRef(false);

  const isContinuousActiveValRef = useRef(isContinuousActive);
  const voiceStateValRef = useRef(voiceState);
  const setIsContinuousActiveRef = useRef(setIsContinuousActive);

  useEffect(() => {
    isContinuousActiveValRef.current = isContinuousActive;
  }, [isContinuousActive]);

  useEffect(() => {
    voiceStateValRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    setIsContinuousActiveRef.current = setIsContinuousActive;
  }, [setIsContinuousActive]);

  // Auto-resize textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to compute actual scrollHeight
    textarea.style.height = 'auto';
    const minHeight = isWelcome ? 72 : 24;
    textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
  }, [input, isWelcome]);

  // Reactive SpeechRecognition engine start/stop bound to voiceState when continuous is active
  useEffect(() => {
    if (!recognitionRef.current || !isContinuousActive) return;

    if (voiceState === 'listening') {
      if (!isRecognitionActiveRef.current && !isStoppingRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.warn('[SPEECH] recognition.start() failed:', e);
        }
      }
    } else {
      if (isRecognitionActiveRef.current && !isStoppingRef.current) {
        isStoppingRef.current = true;
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn('[SPEECH] recognition.stop() failed:', e);
          isStoppingRef.current = false;
        }
      }
    }
  }, [voiceState, isContinuousActive]);

  // Initialize SpeechRecognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      ((window as unknown) as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
      ((window as unknown) as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = speechLang;

      rec.onstart = () => {
        isRecognitionActiveRef.current = true;
        hasLoggedErrorRef.current = false;
        setIsListening(true);
        setSpeechError(null);
      };

      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsListening(false);
        
        if (event.error === 'audio-capture' || event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          if (!hasLoggedErrorRef.current) {
            console.error('[SPEECH ERROR]', event.error);
            hasLoggedErrorRef.current = true;
          }
          setSpeechError(
            'Microphone could not be accessed. Check your microphone connection and browser permission.'
          );
          setIsContinuousActiveRef.current(false);
          setVoiceState('off');
        } else if (event.error === 'aborted') {
          console.debug('[SPEECH INFO] Speech recognition was aborted/interrupted.');
        } else if (event.error !== 'no-speech') {
          if (!hasLoggedErrorRef.current) {
            console.error('[SPEECH ERROR]', event.error);
            hasLoggedErrorRef.current = true;
          }
          setSpeechError(`Speech recognition error: ${event.error}`);
        }
      };

      rec.onend = () => {
        isRecognitionActiveRef.current = false;
        isStoppingRef.current = false;
        setIsListening(false);

        // If continuous mode is active and we are still in listening state,
        // we should restart recognition safely (since it might have stopped naturally due to silence/timeout)
        if (isContinuousActiveValRef.current && voiceStateValRef.current === 'listening') {
          setTimeout(() => {
            if (isContinuousActiveValRef.current && voiceStateValRef.current === 'listening' && !isRecognitionActiveRef.current && !isStoppingRef.current) {
              try {
                rec.start();
              } catch (e) {
                console.warn('[SPEECH] Auto-restart failed:', e);
              }
            }
          }, 100);
        }
      };

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript && finalTranscript.trim()) {
          const cleanFinal = finalTranscript.trim();
          if (isContinuousActiveValRef.current) {
            if (isRecognitionActiveRef.current && !isStoppingRef.current) {
              isStoppingRef.current = true;
              try {
                rec.stop();
              } catch {}
            }
            setIsListening(false);
            setVoiceState('thinking');
            onSendMessage(cleanFinal);
          } else {
            setInput((prev) => {
              const separator = prev && !prev.endsWith(' ') ? ' ' : '';
              return prev + separator + cleanFinal;
            });
          }
        }
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, [speechLang, onSendMessage, setVoiceState]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported in this browser. Please try Chrome or Safari.');
      return;
    }

    if (isListening) {
      if (isRecognitionActiveRef.current && !isStoppingRef.current) {
        isStoppingRef.current = true;
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn('[SPEECH] manual stop failed:', e);
          isStoppingRef.current = false;
        }
      }
      if (isContinuousActive) {
        setIsContinuousActive(false);
        setVoiceState('off');
      }
    } else {
      if (!isRecognitionActiveRef.current && !isStoppingRef.current) {
        setSpeechError(null);
        try {
          recognitionRef.current.start();
          if (isContinuousActive) {
            setVoiceState('listening');
          }
        } catch (e) {
          console.warn('[SPEECH] manual start failed:', e);
        }
      }
    }
  };

  const toggleContinuousMode = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported in this browser. Please try Chrome or Safari.');
      return;
    }

    const nextMode = !isContinuousActive;
    setIsContinuousActive(nextMode);

    if (nextMode) {
      setVoiceState('listening');
      if (!isRecognitionActiveRef.current && !isStoppingRef.current) {
        setSpeechError(null);
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.warn('[SPEECH] continuous start failed:', e);
        }
      }
    } else {
      setVoiceState('off');
      if (isRecognitionActiveRef.current && !isStoppingRef.current) {
        isStoppingRef.current = true;
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn('[SPEECH] continuous stop failed:', e);
          isStoppingRef.current = false;
        }
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }
  };

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

        {speechError && (
          <div className="mx-4 mt-3 flex items-center space-x-2 p-2.5 text-xs bg-rose-50 border border-rose-100 text-rose-600 rounded-xl select-none">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <p className="flex-1 font-medium text-left">{speechError}</p>
            <button 
              type="button" 
              onClick={() => setSpeechError(null)} 
              className="text-rose-450 hover:text-rose-600 font-bold transition-colors cursor-pointer text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md hover:bg-rose-100"
            >
              Dismiss
            </button>
          </div>
        )}

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
          {/* Left icons */}
          <div className="flex items-center space-x-4">
            <button type="button" className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium cursor-pointer" aria-label="Attach file">
              <Paperclip className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">Attach</span>
            </button>
            <button
              type="button"
              onClick={toggleListening}
              className={`flex items-center space-x-1.5 text-xs transition-colors font-medium cursor-pointer ${
                isListening
                  ? 'text-red-600 hover:text-red-500 font-bold animate-pulse'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              aria-label="Voice input"
            >
              <Mic className={`h-3.5 w-3.5 ${isListening ? 'text-red-600' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">{isListening ? 'Listening...' : 'Voice'}</span>
            </button>
            <button
              type="button"
              onClick={toggleContinuousMode}
              className={`flex items-center space-x-1.5 text-xs transition-colors font-medium cursor-pointer ${
                isContinuousActive
                  ? 'text-indigo-600 hover:text-indigo-500 font-bold animate-pulse'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              aria-label="Voice Conversation"
              title="Continuous Voice Conversation"
            >
              <Headphones className={`h-3.5 w-3.5 ${isContinuousActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">{isContinuousActive ? 'Voice Mode Active' : 'Voice Chat'}</span>
            </button>
            <div className="flex items-center space-x-1 border border-slate-200 rounded-lg px-1.5 py-0.5 bg-white shadow-xs">
              <select
                value={speechLang}
                onChange={(e) => setSpeechLang(e.target.value)}
                className="text-[10px] font-semibold text-slate-500 bg-transparent border-none focus:outline-none focus:ring-0 p-0 cursor-pointer"
                title="Speech recognition language"
              >
                <option value="en-US">English</option>
                <option value="ta-IN">Tamil (தமிழ்)</option>
                <option value="hi-IN">Hindi (हिन्दी)</option>
                <option value="te-IN">Telugu (తెలుగు)</option>
                <option value="kn-IN">Kannada (ಕನ್ನಡ)</option>
                <option value="ml-IN">Malayalam (മലയാളം)</option>
              </select>
            </div>
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
      {speechError && (
        <div className="mx-4 mt-3 flex items-center space-x-2 p-2.5 text-xs bg-rose-50 border border-rose-100 text-rose-600 rounded-xl select-none">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
          <p className="flex-1 font-medium text-left">{speechError}</p>
          <button 
            type="button" 
            onClick={() => setSpeechError(null)} 
            className="text-rose-450 hover:text-rose-600 font-bold transition-colors cursor-pointer text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md hover:bg-rose-100"
          >
            Dismiss
          </button>
        </div>
      )}
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
          <button
            type="button"
            onClick={toggleListening}
            className={`p-0.5 rounded-lg transition-colors cursor-pointer ${
              isListening
                ? 'text-red-600 hover:text-red-500 animate-pulse bg-red-50'
                : 'text-slate-400 hover:text-slate-600'
            }`}
            title={isListening ? 'Stop listening' : 'Voice input'}
            aria-label="Voice input"
          >
            <Mic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleContinuousMode}
            className={`p-0.5 rounded-lg transition-colors cursor-pointer ${
              isContinuousActive
                ? 'text-indigo-600 hover:text-indigo-500 animate-pulse bg-indigo-50'
                : 'text-slate-400 hover:text-slate-600'
            }`}
            title={isContinuousActive ? 'Stop Voice Mode' : 'Continuous Voice Conversation'}
            aria-label="Voice Conversation"
          >
            <Headphones className="h-4 w-4" />
          </button>
          <div className="flex items-center space-x-1 border border-slate-200 rounded-lg px-1.5 py-0.5 bg-white shadow-xs">
            <select
              value={speechLang}
              onChange={(e) => setSpeechLang(e.target.value)}
              className="text-[10px] font-semibold text-slate-500 bg-transparent border-none focus:outline-none focus:ring-0 p-0 cursor-pointer"
              title="Speech recognition language"
            >
              <option value="en-US">EN</option>
              <option value="ta-IN">TA</option>
              <option value="hi-IN">HI</option>
              <option value="te-IN">TE</option>
              <option value="kn-IN">KN</option>
              <option value="ml-IN">ML</option>
            </select>
          </div>
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
