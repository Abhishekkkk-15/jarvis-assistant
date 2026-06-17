import React, { useState, useEffect, useRef } from 'react';
import { useGetSettings, getGetSettingsQueryKey, useGetStats, getGetStatsQueryKey, useGetCommandSuggestions, getGetCommandSuggestionsQueryKey, useTranscribeAudio } from '@workspace/api-client-react';
import { Mic, MicOff, Volume2, VolumeX, Send, Activity, Zap, Square } from 'lucide-react';
import { AudioVisualizer } from '../components/AudioVisualizer';
import { useToast } from '@/hooks/use-toast';
import { useLocalStorage } from '@/hooks/use-local-storage';
import ReactMarkdown from 'react-markdown';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useRelationshipEngine } from '@/hooks/useRelationshipEngine';
import { AgentInteractiveOverlay } from '@/components/ui/AgentInteractiveOverlay';
import { useTTS } from '@/hooks/useTTS';

export const JarvisMain: React.FC = () => {
  const [isListening, setIsListening] = useLocalStorage('jarvisIsListening', false);
  const [isSpeaking, setIsSpeaking] = useLocalStorage('jarvisIsSpeaking', false);
  const { affectionScore, mood, interact } = useRelationshipEngine();
  const [, setIsProcessing] = useLocalStorage('jarvisIsProcessing', false);
  const [, setLastReply] = useLocalStorage('jarvisLastReply', '');
  const [, setToolsUsed] = useLocalStorage<string[]>('jarvisToolsUsed', []);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<Array<{ role: string, content: string }>>([]);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const { data: stats } = useGetStats({ query: { queryKey: getGetStatsQueryKey() } });
  const { data: commandSuggestions } = useGetCommandSuggestions({ query: { queryKey: getGetCommandSuggestionsQueryKey() } });

  // TTS hook — Groq key is handled server-side via /tts endpoint
  const tts = useTTS();
  const muted = !tts.isEnabled;

  const { toast } = useToast();

  const transcribeAudio = useTranscribeAudio();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const silenceAudioContextRef = useRef<AudioContext | null>(null);
  const silenceRafRef = useRef<number | null>(null);

  const [activeConversationId, setActiveConversationId] = useLocalStorage<number | null>('activeConversationId', null);

  const { activeApproval, agentQuestion, resolveApproval, clearQuestion } = useWebSocket();

  // Sync streaming state to local storage for the character overlay
  useEffect(() => {
    setIsProcessing(isStreaming);
  }, [isStreaming, setIsProcessing]);

  // Watch for agent_question to start listening
  useEffect(() => {
    if (agentQuestion && !isListening) {
      startListening();
    }
  }, [agentQuestion]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean up and reset ephemeral state on mount/unmount
  useEffect(() => {
    // Clear leftover state from previous sessions
    setLastReply('');
    setToolsUsed([]);
    setIsSpeaking(false);
    setIsListening(false);

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
      setTranscript('Listening... (speak now)');

      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setTranscript('Transcribing...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Convert to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          if (!base64data) {
            setTranscript('');
            return;
          }

          transcribeAudio.mutate({
            data: { audioBase64: base64data, mimeType: 'audio/webm' }
          }, {
            onSuccess: (res) => {
              const text = res.text?.trim();
              if (text) {
                setTranscript(text);
                handleSendMessage(text);
              } else {
                setTranscript('Could not hear anything clearly.');
                setTimeout(() => setTranscript(''), 2000);
              }
            },
            onError: (err) => {
              console.error('Transcription error:', err);
              setTranscript('');
              toast({ title: "Transcription Failed", description: "Failed to process audio.", variant: "destructive" });
            }
          });
        };
      };

      mediaRecorder.start();

      // Setup Voice Activity Detection (VAD) for hands-free auto-stop
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContext();
      silenceAudioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let silenceStart = performance.now();
      let hasSpoken = false;

      const checkSilence = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;

        if (avg > 15) { // Speech threshold
          hasSpoken = true;
          silenceStart = performance.now();
        } else {
          const now = performance.now();
          if (hasSpoken && (now - silenceStart > 2000)) {
            // 2 seconds of silence AFTER they spoke -> assume they finished their command
            stopListening();
            return;
          } else if (!hasSpoken && (now - silenceStart > 7000)) {
            // 7 seconds of complete silence after wake word -> cancel recording
            stopListening();
            return;
          }
        }

        silenceRafRef.current = requestAnimationFrame(checkSilence);
      };
      checkSilence();

    } catch {
      toast({ title: "Microphone Error", description: "Could not access the microphone. Check browser permissions.", variant: "destructive" });
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (silenceRafRef.current) {
      cancelAnimationFrame(silenceRafRef.current);
      silenceRafRef.current = null;
    }
    if (silenceAudioContextRef.current) {
      silenceAudioContextRef.current.close().catch(() => { });
      silenceAudioContextRef.current = null;
    }

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
      // Triggered by Wake Word externally — needs full mic init
      startListening();
    } else if (!isListening && audioStream) {
      stopListening();
    }
  }, [isListening]);

  const NODE_LABELS: Record<string, string> = {
    Init: 'Starting…', Supervisor: 'Planning…', Planner: 'Creating plan…',
    PlanValidator: 'Validating plan…', Executor: 'Executing…', Observer: 'Observing…',
    Verifier: 'Verifying…', Replanner: 'Adjusting plan…', NextStep: 'Next step…',
    Synthesizer: 'Generating response…',
  };

  const handleSendMessage = async (text: string, imageBase64?: string) => {
    if (!text.trim() || isStreaming) return;

    if (agentQuestion) clearQuestion();

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setToolsUsed([]);
    setStreamingContent('');
    setStreamStatus('Starting…');
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('http://localhost:4444/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[System Note - Your Relationship with User: ${mood} (Affection Score: ${Math.round(affectionScore)}/100)]\n\n${text}`,
          conversationId: activeConversationId || undefined,
          model: settings?.selectedModel,
          provider: settings?.selectedProvider,
          imageBase64,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'started' && event.conversationId) {
              setActiveConversationId(event.conversationId);
            } else if (event.type === 'status') {
              setStreamStatus(NODE_LABELS[event.node] ?? `${event.node}…`);
            } else if (event.type === 'token') {
              accumulatedText += event.text;
              setStreamingContent(accumulatedText);
            } else if (event.type === 'done') {
              // accumulatedText has tokens if Synthesizer ran; event.reply is the fallback for Planner-direct responses
              const finalText = accumulatedText || event.reply || '';
              const wordCount = (finalText || '').split(/\s+/).length;
              const boost = wordCount > 50 ? 3 : wordCount > 20 ? 2 : 1;
              interact(boost);

              let finalReply = finalText.replace(/\[Orchestrator\]:/g, '').trim();
              let animTag = '';
              const animMatch = finalReply.match(/\[anim:\s*([a-zA-Z0-9_-]+)\]/i);
              if (animMatch) { animTag = animMatch[1]; finalReply = finalReply.replace(/\[anim:\s*([a-zA-Z0-9_-]+)\]/i, '').trim(); }
              let drawPath = '';
              const drawMatch = finalReply.match(/\[draw:\s*(.+?)\]/i);
              if (drawMatch) { drawPath = drawMatch[1].trim(); finalReply = finalReply.replace(/\[draw:\s*(.+?)\]/i, '').trim(); }

              if (finalReply) setMessages(prev => [...prev, { role: 'assistant', content: finalReply }]);
              setLastReply(finalReply);
              if (animTag) window.dispatchEvent(new CustomEvent('jarvis-action', { detail: { action: animTag.toLowerCase() } }));
              if (drawPath) window.dispatchEvent(new CustomEvent('jarvis-action', { detail: { action: 'draw', path: drawPath } }));
              if (event.toolsUsed?.length) setToolsUsed(event.toolsUsed);
              if (!muted && settings?.voiceEnabled !== false) {
                tts.speak(finalReply);
                setTimeout(() => setToolsUsed([]), Math.max(3000, wordCount * 350));
              } else {
                setTimeout(() => setToolsUsed([]), 5000);
              }
            } else if (event.type === 'error') {
              toast({ title: "Error", description: event.message || "AI error.", variant: "destructive" });
            }
          } catch { }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast({ title: "Error", description: "Failed to reach the AI.", variant: "destructive" });
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      setStreamStatus(null);
      abortControllerRef.current = null;
    }
  };

  const handleStop = async () => {
    abortControllerRef.current?.abort();
    if (activeConversationId) {
      try {
        await fetch('http://localhost:4444/api/chat/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: activeConversationId })
        });
      } catch { }
    }
    toast({ title: "Stopped", description: "Execution aborted by user." });
  };

  const handleMessageWithScreenshot = async (message: string, imageBase64?: string) => {
    let finalImageBase64 = imageBase64;

    // If no image was explicitly passed, automatically capture the screen for True Visual AI context!
    if (!finalImageBase64 && window.electronAPI?.captureScreen) {
      try {
        const screenshot = await window.electronAPI.captureScreen();
        if (screenshot) {
          finalImageBase64 = screenshot;
        }
      } catch (err) {
        console.error("Failed to capture screen:", err);
      }
    }

    handleSendMessage(message, finalImageBase64);
  };

  useEffect(() => {
    const handleGlobalMessage = (e: any) => {
      const { message, imageBase64 } = e.detail;
      if (message) {
        handleMessageWithScreenshot(message, imageBase64);
      }
    };
    const handleSystemEvent = (e: any) => {
      const { eventName } = e.detail;
      const systemMessage = `[System Event]: The user just triggered OS event: ${eventName}. React proactively!`;
      // Call handleSendMessage directly to avoid capturing a screenshot unnecessarily for every system event,
      // or use handleMessageWithScreenshot if we want context. Let's provide context.
      handleMessageWithScreenshot(systemMessage);
    };

    window.addEventListener('jarvis-send-message', handleGlobalMessage);
    window.addEventListener('system-event', handleSystemEvent);
    return () => {
      window.removeEventListener('jarvis-send-message', handleGlobalMessage);
      window.removeEventListener('system-event', handleSystemEvent);
    };
  }, [activeConversationId, settings]);

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawBase64 = event.target?.result as string;
        if (rawBase64) {
          // Resize image to max 1024x1024 to prevent 400 Payload Too Large from APIs
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 1024;
            let width = img.width;
            let height = img.height;

            if (width > height && width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const resizedBase64 = canvas.toDataURL('image/jpeg', 0.85);
              handleSendMessage(`I just dropped an image named \`${file.name}\`. Take a look at it!`, resizedBase64);
            } else {
              handleSendMessage(`I just dropped an image named \`${file.name}\`. Take a look at it!`, rawBase64);
            }
          };
          img.src = rawBase64;
        }
      };
      reader.readAsDataURL(file);
    } else {
      toast({ title: "Unsupported File", description: "Please drop an image file.", variant: "destructive" });
    }
  };

  // Sync isSpeaking from TTS hook to local storage so MiniMode can read it
  useEffect(() => {
    setIsSpeaking(tts.isSpeaking);
  }, [tts.isSpeaking]);

  return (
    <div 
      className="h-full flex flex-col p-5 md:p-8 max-w-6xl mx-auto w-full overflow-y-auto pb-6 relative"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary rounded-xl flex items-center justify-center pointer-events-none">
          <div className="bg-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3">
            <span className="text-2xl animate-bounce">🖼️</span>
            <span className="text-lg font-bold text-primary">Drop image for JARVIS to see</span>
          </div>
        </div>
      )}

      <AgentInteractiveOverlay
        activeApproval={activeApproval}
        agentQuestion={agentQuestion}
        resolveApproval={resolveApproval}
        clearQuestion={clearQuestion}
        onSubmitAnswer={handleMessageWithScreenshot}
      />

      {/* Header */}
      <header className="flex justify-between items-center mb-6 shrink-0 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Assistant</h2>
        </div>
        <button
          onClick={() => tts.toggleEnabled()}
          className={`p-2 rounded-lg border transition-colors ${muted ? 'border-destructive/40 text-destructive bg-destructive/5' : 'border-border text-muted-foreground hover:text-foreground hover:bg-slate-100'}`}
          title={muted ? 'Click to enable JARVIS voice' : 'Click to mute JARVIS voice'}
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
                      <div className="whitespace-pre-wrap">
                        <ReactMarkdown
                          components={{
                            p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                            ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2" {...props} />,
                            ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                            li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                            code: ({ node, ...props }) => <code className="bg-black/10 px-1.5 py-0.5 rounded text-xs" {...props} />,
                            pre: ({ node, ...props }) => <pre className="bg-slate-800 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto mb-2" {...props} />,
                            a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline" {...props} />,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {isStreaming && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] px-4 py-2.5 rounded-xl text-sm leading-relaxed bg-slate-100 text-foreground rounded-bl-sm">
                    <p className="text-[10px] font-semibold opacity-60 mb-1 uppercase tracking-wide">JARVIS</p>
                    {streamingContent ? (
                      <div className="whitespace-pre-wrap">
                        <ReactMarkdown
                          components={{
                            p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                            ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2" {...props} />,
                            ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                            li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                            code: ({ node, ...props }) => <code className="bg-black/10 px-1.5 py-0.5 rounded text-xs" {...props} />,
                            pre: ({ node, ...props }) => <pre className="bg-slate-800 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto mb-2" {...props} />,
                            a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline" {...props} />,
                          }}
                        >
                          {streamingContent}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 py-1">
                        {[0, 150, 300].map((delay) => (
                          <span
                            key={delay}
                            className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 sm:p-4 border-t border-border bg-white/50 backdrop-blur-xl shrink-0">
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
                className="relative flex items-center shadow-sm rounded-2xl group"
              >
                <div className="absolute left-3 sm:left-4 text-muted-foreground group-focus-within:text-primary transition-colors">
                  <Zap size={18} />
                </div>
                <input
                  name="manualInput"
                  type="text"
                  placeholder="Ask JARVIS or type a command..."
                  className="w-full bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200 rounded-2xl pl-10 sm:pl-12 pr-14 sm:pr-28 py-3 sm:py-4 text-sm sm:text-[15px] text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/50 transition-all placeholder:text-muted-foreground/70 shadow-inner"
                  data-testid="input-manual-chat"
                />
                <div className="absolute right-2 flex items-center gap-2">
                  <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border bg-muted px-2 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                    <span className="text-xs">↵</span> Enter
                  </kbd>
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="w-10 h-10 flex items-center justify-center bg-destructive text-white rounded-xl hover:bg-destructive/90 hover:scale-105 active:scale-95 transition-all shadow-md shadow-destructive/20 animate-pulse"
                      title="Stop execution"
                    >
                      <Square size={14} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isStreaming}
                      className="w-10 h-10 flex items-center justify-center bg-primary text-white rounded-xl hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-md shadow-primary/20"
                      data-testid="button-send-chat"
                      title="Send message"
                    >
                      <Send size={16} className="ml-0.5" />
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Right — Stats */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-white p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity size={15} className="text-primary" /> Today's Usage
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-slate-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-primary">{stats?.todayMessages || 0}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Messages</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-primary">{stats?.totalTokens || 0}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Tokens</p>
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
