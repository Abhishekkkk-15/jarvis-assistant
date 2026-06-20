import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Brain, Check, Play, Loader2, ListTodo, Wrench, FileText } from "lucide-react";

export interface ThinkingStep {
  type: "step" | "tool_start" | "tool_result" | "plan";
  node?: string;
  detail: string;
  timestamp: number;
}

export interface PlanStep {
  id?: string;
  title?: string;
  step?: string;
  description?: string;
  category?: string;
  tool_name?: string;
  expectedOutcome?: string;
}

interface ThinkingIndicatorProps {
  steps: ThinkingStep[];
  isThinking: boolean;
  durationMs: number | null;
  plan: PlanStep[] | null;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  steps = [],
  isThinking,
  durationMs,
  plan,
}) => {
  const [isExpanded, setIsExpanded] = useState(isThinking);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Auto-expand when thinking starts, and auto-collapse when thinking ends
  useEffect(() => {
    setIsExpanded(isThinking);
    if (isThinking) {
      setElapsedSeconds(0);
      const timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
    return;
  }, [isThinking]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };

  const displayDuration = durationMs
    ? formatTime(durationMs)
    : isThinking
    ? formatTime(elapsedSeconds * 1000)
    : null;

  if (steps.length === 0 && !isThinking) {
    return null;
  }

  const getStepIcon = (step: ThinkingStep) => {
    switch (step.type) {
      case "plan":
        return <ListTodo className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />;
      case "tool_start":
        return <Wrench className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />;
      case "tool_result":
        return <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />;
      default:
        if (step.node === "Synthesizer") {
          return <FileText className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />;
        }
        return <Brain className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />;
    }
  };

  return (
    <div className="my-2 border border-slate-200/80 rounded-lg bg-slate-50/50 text-slate-700 overflow-hidden transition-all duration-300 max-w-2xl select-none">
      {/* Header Row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isThinking ? (
            <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
          ) : (
            <Brain className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>
            {isThinking
              ? "JARVIS is thinking..."
              : `Thought process completed ${displayDuration ? `in ${displayDuration}` : ""}`}
          </span>
          {isThinking && displayDuration && (
            <span className="text-[10px] text-slate-400 font-mono">({displayDuration})</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      <div
        className={`transition-all duration-300 ease-in-out border-t border-slate-100 no-scrollbar ${
          isExpanded ? "max-h-72 overflow-y-auto" : "max-h-0 overflow-hidden border-t-0"
        }`}
      >
        <div className="p-3.5 space-y-3">
          {/* Execution plan section if available */}
          {plan && plan.length > 0 && (
            <div className="bg-slate-100/80 rounded-md p-2.5 border border-slate-200/50">
              <div className="text-[11px] font-semibold text-indigo-600 mb-1.5 flex items-center gap-1">
                <ListTodo className="w-3 h-3" />
                <span>Execution Plan</span>
              </div>
              <ol className="space-y-1.5">
                {plan.map((p, idx) => {
                  const title = p.title || p.step || p.description || "";
                  const desc = p.description || p.expectedOutcome || "";
                  return (
                    <li key={idx} className="text-[11px] text-slate-600 flex items-start gap-1.5 leading-normal">
                      <span className="font-mono text-indigo-500 shrink-0">{idx + 1}.</span>
                      <div>
                        <span className="text-slate-700 font-medium">{title}</span>
                        {desc && desc !== title && <span className="text-slate-400 block text-[10px]">{desc}</span>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Thinking Steps List */}
          <div className="relative pl-1 border-l border-slate-200 space-y-2.5">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 text-xs animate-fade-in transition-all"
              >
                <div className="bg-slate-100 rounded p-1 shrink-0 border border-slate-200/80">
                  {getStepIcon(step)}
                </div>
                <div className="flex-1 py-0.5 min-w-0">
                  <p className="text-slate-600 break-words leading-relaxed">{step.detail}</p>
                  <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">
                    {new Date(step.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
