import { useEffect, useRef, useState } from 'react';
import { useLocalStorage } from './use-local-storage';
import { useToast } from './use-toast';
import { createModel } from 'vosk-browser';

export const useWakeWord = () => {
  const [isListeningForWakeWord, setIsListeningForWakeWord] = useState(false);
  const recognizerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [jarvisIsListening, setJarvisIsListening] = useLocalStorage('jarvisIsListening', false);
  const [jarvisIsSpeaking] = useLocalStorage('jarvisIsSpeaking', false);
  const { toast } = useToast();

  const jarvisIsListeningRef = useRef(jarvisIsListening);
  const jarvisIsSpeakingRef = useRef(jarvisIsSpeaking);
  const toastRef = useRef(toast);
  const setJarvisIsListeningRef = useRef(setJarvisIsListening);
  
  useEffect(() => {
    jarvisIsListeningRef.current = jarvisIsListening;
    jarvisIsSpeakingRef.current = jarvisIsSpeaking;
    toastRef.current = toast;
    setJarvisIsListeningRef.current = setJarvisIsListening;
  }, [jarvisIsListening, jarvisIsSpeaking, toast, setJarvisIsListening]);

  useEffect(() => {
    let isActive = true;

    const startVosk = async () => {
      try {
        // Load the Vosk model from the public directory as a .zip archive
        const model = await createModel('/vosk-model.zip');
        if (!isActive) {
          model.terminate();
          return;
        }

        const recognizer = new model.KaldiRecognizer(16000);
        recognizer.setWords(true);
        recognizerRef.current = recognizer;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          }
        }).catch(err => {
            console.error("Wake word mic error:", err);
            toast({ title: "Microphone Error", description: "Could not access microphone for wake word.", variant: "destructive" });
            return null;
        });
        streamRef.current = stream;

        if (!stream || !isActive) {
          if (stream) stream.getTracks().forEach(t => t.stop());
          model.terminate();
          return;
        }

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;

        // Use ScriptProcessor for real-time, non-overlapping audio chunking
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        const checkWakeWord = (text: string) => {
          if (!text || jarvisIsListeningRef.current || jarvisIsSpeakingRef.current) return;
          const transcript = text.toLowerCase();
          if (transcript.includes("hey jarvis") || transcript.includes("hi jarvis") || transcript.includes("okay jarvis")) {
            console.log("Wake word detected via Vosk:", transcript);
            setJarvisIsListeningRef.current(true);
            toastRef.current({
              title: "JARVIS is listening",
              description: "Wake word detected. Say your command.",
            });
          }
        };

        recognizer.on("result", (message: any) => {
          const text = message.result?.text;
          if (text) {
            console.log("[Vosk Final]", text);
            checkWakeWord(text);
          }
        });

        recognizer.on("partialresult", (message: any) => {
          const partial = message.result?.partial;
          if (partial) {
            console.log("[Vosk Partial]", partial);
            checkWakeWord(partial);
          }
        });

        let chunkCount = 0;
        processor.onaudioprocess = (e) => {
          chunkCount++;
          if (chunkCount === 5) console.log("[Vosk] ScriptProcessorNode is receiving data correctly!");
          if (!isActive || jarvisIsListeningRef.current || jarvisIsSpeakingRef.current) return;
          
          try {
            const buffer = e.inputBuffer.getChannelData(0);
            if (recognizer.acceptWaveformFloat) {
              recognizer.acceptWaveformFloat(buffer, audioContext.sampleRate);
            } else {
              const audioBuffer = audioContext.createBuffer(1, buffer.length, audioContext.sampleRate);
              audioBuffer.copyToChannel(buffer, 0);
              recognizer.acceptWaveform(audioBuffer);
            }
          } catch (err) {
            console.error("[Vosk] Error processing audio chunk:", err);
          }
        };

        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.001; // 0.1% volume to avoid Chrome suspension
        
        source.connect(processor);
        processor.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(console.error);
            
            // Autoplay policy fallback: resume on first user interaction
            const resumeOnInteraction = () => {
                if (audioContext.state === 'suspended') {
                    audioContext.resume().then(() => {
                        console.log("AudioContext resumed by user interaction!");
                    }).catch(console.error);
                }
                window.removeEventListener('click', resumeOnInteraction);
                window.removeEventListener('keydown', resumeOnInteraction);
            };
            window.addEventListener('click', resumeOnInteraction);
            window.addEventListener('keydown', resumeOnInteraction);
        }
        
        setIsListeningForWakeWord(true);
        console.log("Vosk offline wake word listener started. AudioContext state:", audioContext.state);

      } catch (err) {
        console.error("Vosk initialization error:", err);
      }
    };

    startVosk();

    return () => {
      isActive = false;
      setIsListeningForWakeWord(false);
      
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (recognizerRef.current) {
        try { recognizerRef.current.free(); } catch(e){}
      }
    };
  }, []); // Run ONCE on mount

  return { isListeningForWakeWord };
};
