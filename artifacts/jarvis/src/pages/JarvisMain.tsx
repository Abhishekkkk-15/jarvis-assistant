import React, { useState, useEffect, useRef } from 'react';
import { useSendChat, useGetSettings, getGetSettingsQueryKey, useGetStats, getGetStatsQueryKey, useGetCommandSuggestions, getGetCommandSuggestionsQueryKey } from '@workspace/api-client-react';
import { Mic, MicOff, Volume2, VolumeX, Send, Activity, Zap } from 'lucide-react';
import { AudioVisualizer } from '../components/AudioVisualizer';
import { useToast } from '@/hooks/use-toast';
import { useLocalStorage } from '@/hooks/use-local-storage';

export const JarvisMain: React.FC = () => {
  const [isListening, setIsListening] = useLocalStorage('jarvisIsListening', false);
  const [isSpeaking, setIsSpeaking] = useLocalStorage('jarvisIsSpeaking', false);
  const [, setLastReply] = useLocalStorage('jarvisLastReply', '');
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<Array<{ role: string, content: string }>>([]);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);

  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const { data: stats } = useGetStats({ query: { queryKey: getGetStatsQueryKey() } });
  const { data: commandSuggestions } = useGetCommandSuggestions({ query: { queryKey: getGetCommandSuggestionsQueryKey() } });

  const sendChat = useSendChat();
  const { toast } = useToast();

  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [activeConversationId, setActiveConversationId] = useLocalStorage<number | null>('activeConversationId', null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript(finalTranscript);
          handleSendMessage(finalTranscript);
        } else {
          setTranscript(interimTranscript);
        }
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
        stopAudioStream();
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        stopAudioStream();
      };
    } else {
      toast({ title: "Speech Recognition Unavailable", description: "Your browser doesn't support the Web Speech API.", variant: "destructive" });
    }

    return () => {
      stopAudioStream();
      if (synthesisRef.current) window.speechSynthesis.cancel();
    };
  }, []);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      setIsListening(true);
      setTranscript('');
      recognitionRef.current?.start();
    } catch {
      toast({ title: "Microphone Error", description: "Could not access the microphone.", variant: "destructive" });
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    stopAudioStream();
  };

  const stopAudioStream = () => {
    if (audioStream) {
      audioStream.getTracks().forEach(t => t.stop());
      setAudioStream(null);
    }
  };

  useEffect(() => {
    if (isListening && !audioStream) {
      // Triggered by Wake Word externally
      startListening();
    } else if (!isListening && audioStream) {
      stopListening();
    }
  }, [isListening, audioStream]);

  const handleSendMessage = (text: string, imageBase64?: string) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    sendChat.mutate({
      data: { 
        message: text, 
        conversationId: activeConversationId || undefined, 
        model: settings?.selectedModel, 
        provider: settings?.selectedProvider,
        imageBase64
      }
    }, {
      onSuccess: (data) => {
        if (data.conversationId) setActiveConversationId(data.conversationId);
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        setLastReply(data.reply);
        if (!muted && settings?.voiceEnabled !== false) speak(data.reply);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to reach the AI.", variant: "destructive" });
      }
    });
  };

  useEffect(() => {
    const handleGlobalMessage = (e: any) => {
      const { message, imageBase64 } = e.detail;
      if (message) {
        handleSendMessage(message, imageBase64);
      }
    };
    window.addEventListener('jarvis-send-message', handleGlobalMessage);
    return () => window.removeEventListener('jarvis-send-message', handleGlobalMessage);
  }, [activeConversationId, settings]);

  const speak = (text: string) => {
    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'));
    if (preferred) utterance.voice = preferred;
    utterance.pitch = 1;
    utterance.rate = 1.05;
    utterance.onend = () => setIsSpeaking(false);
    synthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="h-full flex flex-col p-5 md:p-8 max-w-6xl mx-auto w-full overflow-y-auto pb-6">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 shrink-0 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Assistant</h2>
          <p className="text-sm text-muted-foreground">{settings?.selectedModel || 'No model selected'}</p>
        </div>
        <button
          onClick={() => setMuted(!muted)}
          className={`p-2 rounded-lg border transition-colors ${muted ? 'border-destructive/40 text-destructive bg-destructive/5' : 'border-border text-muted-foreground hover:text-foreground hover:bg-slate-100'}`}
          data-testid="button-mute"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">

        {/* Left — Interaction */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Orb / Visualizer area */}
          <div className="rounded-xl border border-border bg-slate-50 flex flex-col items-center justify-center p-8 gap-5 min-h-[200px] shrink-0">
            <div className={`w-24 h-24 rounded-full bg-primary/10 border-2 flex items-center justify-center transition-all duration-300 ${isListening || isSpeaking ? 'border-primary animate-pulse-ring' : 'border-primary/30'}`}>
              <div className={`w-12 h-12 rounded-full transition-all duration-300 ${isListening ? 'bg-primary animate-ping' : isSpeaking ? 'bg-primary/70 animate-bounce' : 'bg-primary/30'}`} />
            </div>
            {transcript && (
              <p className="text-sm text-foreground font-medium text-center italic">"{transcript}"</p>
            )}
            {isListening && !transcript && (
              <p className="text-sm text-muted-foreground animate-pulse">Listening…</p>
            )}
          </div>

          {/* Quick commands */}
          {commandSuggestions && commandSuggestions.flatMap(c => c.examples).length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 shrink-0">
              {commandSuggestions.flatMap(c => c.examples).slice(0, 5).map((cmd, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(cmd)}
                  className="px-3 py-1.5 whitespace-nowrap bg-white border border-border hover:bg-slate-50 hover:border-primary/40 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                  data-testid={`button-quick-command-${i}`}
                >
                  <Zap size={11} className="text-primary" /> {cmd}
                </button>
              ))}
            </div>
          )}

          {/* Mic + visualizer */}
          <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-white shrink-0">
            <button
              onClick={isListening ? stopListening : startListening}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shrink-0 ${isListening
                  ? 'bg-destructive/10 border-2 border-destructive text-destructive'
                  : 'bg-primary/10 border-2 border-primary text-primary hover:bg-primary/20'
                }`}
              data-testid="button-mic"
            >
              {isListening ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <div className="flex-1">
              <AudioVisualizer isListening={isListening} stream={audioStream} />
            </div>
          </div>

          {/* Conversation / Chat */}
          <div className="flex-1 min-h-[240px] flex flex-col rounded-xl border border-border bg-white overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Start by speaking or typing below
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${msg.role === 'user'
                        ? 'bg-primary text-white rounded-br-sm'
                        : 'bg-slate-100 text-foreground rounded-bl-sm'
                      }`}>
                      <p className="text-[10px] font-semibold opacity-60 mb-1 uppercase tracking-wide">
                        {msg.role === 'user' ? 'You' : 'JARVIS'}
                      </p>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-border bg-slate-50 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const input = form.elements.namedItem('manualInput') as HTMLInputElement;
                  if (input.value.trim()) {
                    handleSendMessage(input.value.trim());
                    input.value = '';
                  }
                }}
                className="flex gap-2"
              >
                <input
                  name="manualInput"
                  type="text"
                  placeholder="Type a message…"
                  className="flex-1 bg-white border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  data-testid="input-manual-chat"
                />
                <button
                  type="submit"
                  disabled={sendChat.isPending}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  data-testid="button-send-chat"
                >
                  <Send size={15} /> Send
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right — Stats */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-white p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity size={15} className="text-primary" /> Usage
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-slate-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-primary">{stats?.todayMessages || 0}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Today</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-primary">{stats?.totalConversations || 0}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Total</p>
              </div>
            </div>
            {stats?.topCommands && stats.topCommands.length > 0 && (
              <div className="pt-4 border-t border-border">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">Top commands</p>
                <div className="space-y-1.5">
                  {stats.topCommands.map((cmd, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-foreground truncate pr-2">{cmd.command}</span>
                      <span className="text-muted-foreground shrink-0">{cmd.count}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
