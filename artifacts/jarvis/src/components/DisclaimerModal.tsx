import React from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { Shield, Lock, Eye, AlertTriangle } from 'lucide-react';

export const DisclaimerModal: React.FC = () => {
  const [accepted, setAccepted] = useLocalStorage('jarvisDisclaimerAccepted', false);

  if (accepted) return null;

  const handleAccept = () => {
    setAccepted(true);
  };

  const handleDecline = () => {
    if (window.electronAPI && typeof window.electronAPI.closeWindow === 'function') {
      window.electronAPI.closeWindow();
    } else {
      window.close();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white/95 border border-slate-200 shadow-2xl rounded-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header Banner */}
        <div className="bg-primary/5 border-b border-primary/10 p-6 flex items-center gap-4 shrink-0">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Shield size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Security & Privacy Disclaimer</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Please review before using JARVIS</p>
          </div>
        </div>

        {/* Scrollable Terms Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-600 leading-relaxed">
          <p>
            Welcome to <strong>JARVIS Assistant</strong>. To function as an intelligent desktop companion, the application requires specific system level accesses. Please read the following disclosures carefully:
          </p>

          <div className="flex gap-3.5">
            <div className="text-amber-500 shrink-0 mt-0.5">
              <Eye size={18} />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 text-sm">Contextual Screen Capture</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                When Contextual Awareness is enabled, JARVIS captures screenshots of your active window and reads focused application titles. This visual context is sent to secure, external AI models (e.g. Google Gemini, OpenAI, Groq) to provide smart help, task recommendations, and autonomous commentary.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5">
            <div className="text-blue-500 shrink-0 mt-0.5">
              <Lock size={18} />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 text-sm">System & Terminal Execution</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                JARVIS has the ability to run shell commands, view and modify files, and call local system tools to automate tasks on your behalf. Standard security boundaries apply, and you will always have visibility over execution processes.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5">
            <div className="text-rose-500 shrink-0 mt-0.5">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 text-sm">Third-Party AI Models</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your queries, screen context, and file summaries are processed using third-party AI APIs configured in your settings. Please review your own key usages and rate limits.
              </p>
            </div>
          </div>
          
          <p className="text-xs bg-slate-50 border border-slate-100 rounded-lg p-3 text-muted-foreground">
            By clicking <strong>"I Accept"</strong>, you acknowledge and consent to these features. If you do not consent, you must decline, which will close the application.
          </p>
        </div>

        {/* Action Buttons Footer */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 flex gap-3 justify-end shrink-0">
          <button 
            onClick={handleDecline}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-700 transition-colors"
          >
            Decline
          </button>
          <button 
            onClick={handleAccept}
            className="px-5 py-2 bg-primary hover:bg-primary/95 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
          >
            I Accept
          </button>
        </div>

      </div>
    </div>
  );
};
