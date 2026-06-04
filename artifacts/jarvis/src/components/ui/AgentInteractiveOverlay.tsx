import React from 'react';

export interface ApprovalRequest {
  requestId: string;
  reason: string;
}

interface AgentInteractiveOverlayProps {
  activeApproval: ApprovalRequest | null;
  agentQuestion: string | null;
  resolveApproval: (requestId: string, decision: 'approved' | 'denied') => void;
  clearQuestion: () => void;
  onSubmitAnswer?: (answer: string) => void;
}

export const AgentInteractiveOverlay: React.FC<AgentInteractiveOverlayProps> = ({
  activeApproval,
  agentQuestion,
  resolveApproval,
  clearQuestion,
  onSubmitAnswer
}) => {
  if (!activeApproval && !agentQuestion) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-300">

        {activeApproval && (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center text-3xl mb-2 animate-pulse">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-white">Approval Required</h2>
            <p className="text-slate-300 text-sm">
              JARVIS wants to perform a potentially destructive action:
            </p>
            <div className="bg-black/40 p-4 rounded-xl text-slate-200 border border-slate-800 text-left w-full text-sm font-mono mt-2 break-words">
              {activeApproval.reason}
            </div>
            <div className="flex space-x-3 w-full mt-6">
              <button
                onClick={() => resolveApproval(activeApproval.requestId, 'denied')}
                className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 py-2.5 rounded-xl font-semibold transition-colors"
              >
                Deny
              </button>
              <button
                onClick={() => resolveApproval(activeApproval.requestId, 'approved')}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)] py-2.5 rounded-xl font-semibold transition-all hover:scale-[1.02]"
              >
                Approve
              </button>
            </div>
          </div>
        )}

        {agentQuestion && !activeApproval && (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-3xl mb-2 animate-bounce">
              💬
            </div>
            <h2 className="text-xl font-bold text-white">JARVIS is Asking...</h2>
            <p className="text-slate-200 text-lg font-medium leading-relaxed my-4">
              "{agentQuestion}"
            </p>
            <div className="flex items-center space-x-3 bg-blue-500/10 px-4 py-2 rounded-full mt-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-sm font-medium text-slate-300">Listening for your answer...</span>
            </div>

            <div className="w-full mt-4 flex gap-2">
              <input
                type="text"
                id="agent-question-input"
                placeholder="Or type your answer here..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = e.currentTarget.value;
                    if (val.trim() && onSubmitAnswer) {
                      onSubmitAnswer(val);
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  const input = document.getElementById('agent-question-input') as HTMLInputElement;
                  if (input && input.value.trim() && onSubmitAnswer) {
                    onSubmitAnswer(input.value);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                Send
              </button>
            </div>

            <button
              onClick={clearQuestion}
              className="mt-4 text-slate-500 hover:text-slate-300 text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
