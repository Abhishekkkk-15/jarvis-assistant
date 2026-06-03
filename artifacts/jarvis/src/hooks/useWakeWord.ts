import { useEffect, useRef, useState } from 'react';
import { useLocalStorage } from './use-local-storage';
import { useToast } from './use-toast';

export const useWakeWord = () => {
  const [isListeningForWakeWord, setIsListeningForWakeWord] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [, setJarvisIsListening] = useLocalStorage('jarvisIsListening', false);
  const { toast } = useToast();

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported in this browser.");
      return;
    }

    const initRecognition = () => {
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Keep listening continuously
      recognition.interimResults = true; // Check words as they are spoken
      
      recognition.onstart = () => {
        setIsListeningForWakeWord(true);
        console.log("Wake word listener started.");
      };

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript.toLowerCase();
          
          // Check for wake words
          if (transcript.includes("hey jarvis") || transcript.includes("hi jarvis") || transcript.includes("okay jarvis")) {
            console.log("Wake word detected:", transcript);
            setJarvisIsListening(true);
            
            // Show toast notification
            toast({
              title: "JARVIS is listening",
              description: "Wake word detected. Say your command.",
            });
            
            // We could optionally pause the wake word listener here,
            // but we'll let it keep running.
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Wake word listener error:", event.error);
        setIsListeningForWakeWord(false);
      };

      recognition.onend = () => {
        // Automatically restart if it stops (e.g. due to silence)
        setIsListeningForWakeWord(false);
        console.log("Wake word listener ended, restarting in 1s...");
        setTimeout(() => {
          try {
            recognitionRef.current?.start();
          } catch (e) {
            console.error("Failed to restart wake word listener:", e);
          }
        }, 1000);
      };

      return recognition;
    };

    recognitionRef.current = initRecognition();

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error("Failed to start initial wake word listener:", e);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null; // Prevent restart on unmount
        recognitionRef.current.stop();
      }
    };
  }, []);

  return { isListeningForWakeWord };
};
