import React, { useState, useEffect, useRef } from 'react';
import { ThinkingIndicator, ThinkingStep, PlanStep } from '../components/ui/ThinkingIndicator';
import { useGetSettings, getGetSettingsQueryKey, useGetStats, getGetStatsQueryKey, useGetCommandSuggestions, getGetCommandSuggestionsQueryKey, useTranscribeAudio, useGetConversation, getGetConversationQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Mic, MicOff, Volume2, VolumeX, Send, Activity, Zap, Square, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { AudioVisualizer } from '../components/AudioVisualizer';
import { useToast } from '@/hooks/use-toast';
import { useLocalStorage } from '@/hooks/use-local-storage';
import ReactMarkdown from 'react-markdown';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useRelationshipEngine } from '@/hooks/useRelationshipEngine';
import { AgentInteractiveOverlay } from '@/components/ui/AgentInteractiveOverlay';
import { useTTS } from '@/hooks/useTTS';

// Whisper frequently hallucinates YouTube-outro-style phrases (or bare punctuation) when fed
// silence/background noise instead of real speech. Normalize and pattern-match rather than
// requiring an exact string match, since the model varies wording/punctuation each time.
const HALLUCINATION_PATTERNS = [
  /^(thanks?|thank you)( so much| very much)?( for watching)?$/,
  /thanks? for watching/,
  /welcome to my channel/,
  /^hello everyone/,
  /(please )?(like( and|,)? )?subscribe( to my channel)?$/,
  /don'?t forget to (like|subscribe)/,
  /see you (in the )?next (video|time)/,
  /^(bye|goodbye)( bye)?$/,
  /i'?m going to make a/,
];

function isWhisperHallucination(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Empty, or just punctuation/symbols (e.g. ",", "...", "-")
  if (!normalized) return true;

  return HALLUCINATION_PATTERNS.some((re) => re.test(normalized));
}

export const JarvisMain: React.FC = () => {
  const queryClient = useQueryClient();
  const [isListening, setIsListening] = useLocalStorage('jarvisIsListening', false);
  const [isSpeaking, setIsSpeaking] = useLocalStorage('jarvisIsSpeaking', false);
  const { affectionScore, mood, interact } = useRelationshipEngine();
  const [, setIsProcessing] = useLocalStorage('jarvisIsProcessing', false);
  const [, setLastReply] = useLocalStorage('jarvisLastReply', '');
  const [, setToolsUsed] = useLocalStorage<string[]>('jarvisToolsUsed', []);
  const [, setStreamStatusStore] = useLocalStorage<string | null>('jarvisStreamStatus', null);
  const [transcript, setTranscript] = useState('');
  interface ChatMessage {
    role: string;
    content: string;
    thinkingMetadata?: {
      durationMs: number | null;
      plan: PlanStep[] | null;
      steps: ThinkingStep[];
    } | null;
  }
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingDuration, setThinkingDuration] = useState<number | null>(null);
  const [thinkingPlan, setThinkingPlan] = useState<PlanStep[] | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const isStreamingRef = useRef(false);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

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

  const { data: activeConversationDetail } = useGetConversation(activeConversationId!, {
    query: {
      queryKey: getGetConversationQueryKey(activeConversationId!),
      enabled: !!activeConversationId,
    }
  });

  const cleanMessageContent = (role: string, content: string) => {
    if (!content) return '';
    if (role === 'user') {
      return content
        .replace(/^\[System Note - Your Relationship with User:.*?\]\s*/is, '')
        .replace(/^\[User Active Window Context - Application:.*?, Window Title: ".*?"\]\s*/is, '');
    } else {
      return content
        .replace(/\[anim:\s*[a-zA-Z0-9_-]+\]/gi, '')
        .replace(/\[draw:\s*.+?\]/gi, '')
        .replace(/\[Orchestrator\]:/g, '')
        .trim();
    }
  };

  useEffect(() => {
    if (activeConversationDetail?.messages) {
      const mapped = activeConversationDetail.messages.map(m => ({
        role: m.role,
        content: cleanMessageContent(m.role, m.content),
        thinkingMetadata: (m as any).thinkingMetadata
      }));
      setMessages(mapped);
    } else if (!activeConversationId) {
      setMessages([]);
    }
  }, [activeConversationDetail, activeConversationId]);

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

  // Continuous Voice Mode
  useEffect(() => {
    if (continuousVoiceQueuedRef.current && !tts.isSpeaking && !isStreaming && !isListening) {
      // Consume the queue flag so it only triggers once per response
      continuousVoiceQueuedRef.current = false;

      // 500ms delay to prevent picking up the very end of the TTS audio/echo
      const t = setTimeout(() => {
        if (!isListening && !isStreamingRef.current) {
          startListening();
        }
      }, 500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [tts.isSpeaking, isStreaming, isListening]);

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

  const hasSpokenRef = useRef(false);
  const wasLastInteractionVoiceRef = useRef(false);
  const continuousVoiceQueuedRef = useRef(false);
  const manualStopRef = useRef(false);

  const startListening = async () => {
    if (isStreamingRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      setIsListening(true);
      setTranscript('Listening... (speak now)');
      hasSpokenRef.current = false;
      wasLastInteractionVoiceRef.current = true;
      manualStopRef.current = false;

      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (!hasSpokenRef.current) {
          setTranscript('No speech detected.');
          setTimeout(() => setTranscript(''), 2000);
          return;
        }

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
              let text = res.text?.trim();

              // Filter out common Whisper hallucinations on background noise/silence
              if (text && isWhisperHallucination(text)) {
                text = "";
              }

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

      const checkSilence = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;

        if (avg > 15) { // Speech threshold
          hasSpokenRef.current = true;
          silenceStart = performance.now();
        } else {
          const now = performance.now();
          if (hasSpokenRef.current && (now - silenceStart > 2000)) {
            // 2 seconds of silence AFTER they spoke -> assume they finished their command
            stopListening();
            return;
          } else if (!hasSpokenRef.current && (now - silenceStart > 7000)) {
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

  // Manually clicking the mic to stop means "I'm done," not "pause for a follow-up" — unlike
  // VAD's silence-based auto-stop, it should suppress that turn's continuous-voice restart even
  // if the captured audio still gets transcribed and sent.
  const handleMicButtonClick = () => {
    if (isListening) {
      manualStopRef.current = true;
      continuousVoiceQueuedRef.current = false;
      stopListening();
    } else {
      startListening();
    }
  };

  useEffect(() => {
    if (isListening && !audioStream) {
      if (isStreamingRef.current) {
        setIsListening(false);
        return;
      }
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

    if (settings?.continuousVoiceMode && wasLastInteractionVoiceRef.current && !manualStopRef.current) {
      continuousVoiceQueuedRef.current = true;
    }

    if (agentQuestion) clearQuestion();

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setToolsUsed([]);
    setStreamingContent('');
    setStreamStatus('Starting…');
    setIsStreaming(true);
    setIsProcessing(true);

    // Reset thinking states
    setThinkingSteps([]);
    setIsThinking(false);
    setThinkingDuration(null);
    setThinkingPlan(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const autonomousMode = localStorage.getItem('jarvisAutonomousMode') === 'true';
    const activeWin = (window as any).lastActiveWindow;
    let contextPrefix = `[System Note - Your Relationship with User: ${mood} (Affection Score: ${Math.round(affectionScore)}/100)]\n`;
    if (autonomousMode && activeWin) {
      contextPrefix += `[User Active Window Context - Application: ${activeWin.owner?.name || 'Unknown'}, Window Title: "${activeWin.title || ''}"]\n`;
    }

    try {
      const response = await fetch('http://localhost:4444/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `${contextPrefix}\n${text}`,
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
            } else if (event.type === 'thinking_start') {
              setIsThinking(true);
              setStreamStatusStore('Supervisor');
              setThinkingSteps([]);
              setThinkingPlan(null);
              setThinkingDuration(null);
            } else if (event.type === 'thinking_step') {
              setThinkingSteps(prev => [...prev, {
                type: 'step',
                node: event.node,
                detail: event.detail,
                timestamp: event.timestamp
              }]);
            } else if (event.type === 'thinking_tool') {
              setThinkingSteps(prev => [...prev, {
                type: 'tool_start',
                node: event.name,
                detail: event.step?.detail || `Calling tool ${event.name}`,
                timestamp: event.step?.timestamp || Date.now()
              }]);
            } else if (event.type === 'thinking_tool_result') {
              setThinkingSteps(prev => [...prev, {
                type: 'tool_result',
                node: event.name,
                detail: event.step?.detail || `Tool ${event.name} completed`,
                timestamp: event.step?.timestamp || Date.now()
              }]);
            } else if (event.type === 'thinking_plan') {
              setThinkingPlan(event.steps);
              setThinkingSteps(prev => [...prev, {
                type: 'plan',
                detail: `Generated execution plan with ${event.steps?.length || 0} steps`,
                timestamp: Date.now()
              }]);
            } else if (event.type === 'thinking_end') {
              setIsThinking(false);
              setThinkingDuration(event.durationMs);
            } else if (event.type === 'status') {
              setStreamStatus(NODE_LABELS[event.node] ?? `${event.node}…`);
              setStreamStatusStore(event.node);
            } else if (event.type === 'token') {
              accumulatedText += event.text;
              setStreamingContent(cleanMessageContent('assistant', accumulatedText));
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

              if (finalReply) {
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: finalReply,
                  thinkingMetadata: thinkingSteps.length > 0 ? {
                    durationMs: thinkingDuration,
                    plan: thinkingPlan,
                    steps: thinkingSteps
                  } : null
                }]);
              }
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
              // Invalidate query key to sync messages in background
              const convId = event.conversationId || activeConversationId;
              if (convId) {
                queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(convId) });
              }
            } else if (event.type === 'error') {
              toast({ title: "Error", description: event.message || "AI error.", variant: "destructive" });
              window.dispatchEvent(new CustomEvent('jarvis-action', { detail: { action: 'sad' } }));
            }
          } catch { }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast({ title: "Error", description: "Failed to reach the AI.", variant: "destructive" });
        window.dispatchEvent(new CustomEvent('jarvis-action', { detail: { action: 'angry' } }));
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      setStreamStatus(null);
      setStreamStatusStore(null);
      setIsProcessing(false);
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

    const filePath = (file as any).path || '';
    const isAbsolutePath = filePath && (filePath.includes('\\') || filePath.includes('/'));

    if (file.name.toLowerCase().endsWith('.pdf')) {
      if (isAbsolutePath) {
        handleSendMessage(`Please read and summarize this PDF file: "${filePath}"`);
      } else {
        handleSendMessage(`Please find and then read/summarize the PDF file: "${file.name}". Search for it using search_everything first since I dragged and dropped it but the browser sandbox hid its path.`);
      }
    } else if (file.type.startsWith('image/')) {
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
      // Treat other files as text/code files
      if (isAbsolutePath) {
        handleSendMessage(`Please read and analyze this file: "${filePath}"`);
      } else {
        handleSendMessage(`Please find and then read/analyze this file: "${file.name}". Search for it using search_everything first since I dragged and dropped it but the browser sandbox hid its path.`);
      }
    }
  };

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
            <span className="text-2xl animate-bounce">📁</span>
            <span className="text-lg font-bold text-primary">Drop image, PDF, or text file for JARVIS</span>
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
      <header className="flex justify-between items-center mb-6 shrink-0 select-none border-b border-border pb-4" style={{ WebkitAppRegion: 'drag' } as any}>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Assistant</h2>
        </div>
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
          {/* Inline Token Stats */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-xs text-slate-600 font-medium">
            <span className="flex items-center gap-1"><Activity size={12} className="text-primary" /> {stats?.todayMessages || 0} messages</span>
            <span className="w-px h-3 bg-slate-200" />
            <span>{stats?.totalTokens || 0} tokens</span>
          </div>


          <button
            onClick={() => {
              setActiveConversationId(null);
              setMessages([]);
              toast({ title: "New Conversation", description: "Started a fresh chat session." });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
            title="Start a new conversation"
            data-testid="button-new-chat"
          >
            <Plus size={14} />
            <span>New Chat</span>
          </button>
          <button
            onClick={() => tts.toggleEnabled()}
            className={`p-2 rounded-lg border transition-colors ${muted ? 'border-destructive/40 text-destructive bg-destructive/5' : 'border-border text-muted-foreground hover:text-foreground hover:bg-slate-100'}`}
            title={muted ? 'Click to enable JARVIS voice' : 'Click to mute JARVIS voice'}
            data-testid="button-mute"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </header>

      {/* Option A Layout: Full width, vertical chat flow with controls at bottom */}
      <div className="flex-1 flex flex-col gap-4 min-h-0 relative">

        {/* Chat History Container (Spans full page width and stretches vertically) */}
        <div className="flex-1 rounded-xl border border-border bg-white overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Start by speaking or typing below
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] break-words [word-break:break-word] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${msg.role === 'user'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-slate-100 text-foreground rounded-bl-sm'
                    }`}>
                    <p className="text-[10px] font-semibold opacity-60 mb-1 uppercase tracking-wide">
                      {msg.role === 'user' ? 'You' : 'JARVIS'}
                    </p>
                    <div className="whitespace-pre-wrap break-words [word-break:break-word]">
                      {msg.role === 'assistant' && msg.thinkingMetadata && (
                        <ThinkingIndicator
                           steps={msg.thinkingMetadata.steps}
                           isThinking={false}
                           durationMs={msg.thinkingMetadata.durationMs}
                           plan={msg.thinkingMetadata.plan}
                        />
                      )}
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
                <div className="max-w-[80%] break-words [word-break:break-word] px-4 py-2.5 rounded-xl text-sm leading-relaxed bg-slate-100 text-foreground rounded-bl-sm">
                  <p className="text-[10px] font-semibold opacity-60 mb-1 uppercase tracking-wide">JARVIS</p>
                  {(isThinking || thinkingSteps.length > 0) && (
                    <ThinkingIndicator
                      steps={thinkingSteps}
                      isThinking={isThinking}
                      durationMs={thinkingDuration}
                      plan={thinkingPlan}
                    />
                  )}
                  {streamingContent ? (
                    <div className="whitespace-pre-wrap break-words [word-break:break-word]">
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
                    !isThinking && (
                      <div className="flex items-center gap-1 py-1">
                        {[0, 150, 300].map((delay) => (
                          <span
                            key={delay}
                            className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Unified Controls Bottom Panel (Suggestions, Mic Visualizer, & Input inline) */}
          <div className="p-4 border-t border-border bg-slate-50/50 backdrop-blur-xl flex flex-col gap-3 shrink-0">
            {/* Quick action suggest list */}
            {commandSuggestions && commandSuggestions.flatMap(c => c.examples).length > 0 && showQuickActions && (
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar shrink-0 animate-in slide-in-from-top-1 duration-200">
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

            {/* Mic visualizer, Transcript text, & Textarea Input controls */}
            <div className="flex items-start gap-4 bg-white p-3 rounded-2xl border border-border">
              {/* Mic action orb */}
              <button
                onClick={handleMicButtonClick}
                disabled={isStreaming}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0 mt-0.5 ${
                  isStreaming 
                    ? 'bg-slate-100 border-2 border-slate-300 text-slate-400 cursor-not-allowed opacity-50'
                    : isListening
                      ? 'bg-destructive/10 border-2 border-destructive text-destructive'
                      : 'bg-primary/10 border-2 border-primary text-primary hover:bg-primary/20'
                }`}
                data-testid="button-mic"
                title={isListening ? "Stop listening" : "Start voice control"}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              {/* Combined Audio Visualizer / Textarea display */}
              <div className="flex-1 min-w-0 flex flex-col justify-center min-h-[48px]">
                {isListening ? (
                  <div className="h-6 w-full max-w-[200px] mt-3">
                    <AudioVisualizer isListening={isListening} stream={audioStream} />
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const textarea = form.elements.namedItem('manualInput') as HTMLTextAreaElement;
                      if (textarea.value.trim()) {
                        wasLastInteractionVoiceRef.current = false;
                        handleSendMessage(textarea.value.trim());
                        textarea.value = '';
                      }
                    }}
                    className="relative flex items-center w-full"
                  >
                    <textarea
                      name="manualInput"
                      rows={1}
                      placeholder={transcript || "Ask JARVIS or type a command..."}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          const form = e.currentTarget.form;
                          if (form) {
                            form.requestSubmit();
                          }
                        }
                      }}
                      className="w-full bg-transparent border-0 py-2 pr-20 text-sm text-foreground focus:outline-none placeholder:text-muted-foreground/75 resize-none min-h-[32px] max-h-[160px] overflow-y-auto no-scrollbar"
                      data-testid="input-manual-chat"
                      ref={(el) => {
                        if (el) {
                          el.style.height = 'auto';
                          el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                        }
                      }}
                      onChange={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                      }}
                    />
                    <div className="absolute right-0 bottom-2 flex items-center gap-2 z-10">
                      {commandSuggestions && commandSuggestions.flatMap(c => c.examples).length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowQuickActions(prev => !prev)}
                          className={`p-1 rounded hover:bg-slate-100 transition-colors text-muted-foreground hover:text-foreground`}
                          title={showQuickActions ? "Hide suggestions" : "Show suggestions"}
                        >
                          {showQuickActions ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        </button>
                      )}
                      <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[9px] font-medium text-muted-foreground opacity-70">
                        <span className="text-[10px]">↵</span> Enter
                      </kbd>
                    </div>
                  </form>
                )}
              </div>

              {/* Inline Send / Stop Trigger */}
              <div className="shrink-0 mt-0.5">
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
                    onClick={() => {
                      const textarea = document.querySelector('textarea[name="manualInput"]') as HTMLTextAreaElement;
                      if (textarea && textarea.value.trim()) {
                        wasLastInteractionVoiceRef.current = false;
                        handleSendMessage(textarea.value.trim());
                        textarea.value = '';
                        textarea.style.height = 'auto';
                      }
                    }}
                    disabled={isStreaming}
                    className="w-10 h-10 flex items-center justify-center bg-primary text-white rounded-xl hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-md shadow-primary/20"
                    data-testid="button-send-chat"
                    title="Send message"
                  >
                    <Send size={16} className="ml-0.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Float transcript details above input when active */}
            {isListening && transcript && (
              <p className="text-xs text-foreground font-medium text-center italic mt-1">"{transcript}"</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
