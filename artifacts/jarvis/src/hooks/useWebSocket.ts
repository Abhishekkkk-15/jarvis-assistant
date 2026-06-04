import { useEffect, useState, useRef } from 'react';

export interface ApprovalRequest {
  requestId: string;
  reason: string;
}

export function useWebSocket() {
  const [activeApproval, setActiveApproval] = useState<ApprovalRequest | null>(null);
  const [agentQuestion, setAgentQuestion] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Attempt to connect to the backend WebSocket
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const url = `${protocol}//${host}/ws`;
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('[WebSocket] Connected to JARVIS backend');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'approval_needed') {
            setActiveApproval({
              requestId: data.requestId,
              reason: data.reason
            });
          }
          else if (data.type === 'approval_resolved') {
            setActiveApproval(null);
          }
          else if (data.type === 'agent_question') {
            setAgentQuestion(data.question);
            // Auto clear question after 15 seconds or when answered
            setTimeout(() => setAgentQuestion(null), 15000);
          }
          else if (data.type === 'system_notification') {
            window.dispatchEvent(new CustomEvent('jarvis-system-notification', { detail: data }));
          }
        } catch (err) {
          console.error('[WebSocket] Error parsing message', err);
        }
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected, retrying in 3s...');
        setTimeout(connect, 3000);
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const resolveApproval = async (requestId: string, decision: 'approved' | 'denied') => {
    try {
      await fetch('/api/commands/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, decision })
      });
      setActiveApproval(null);
    } catch (e) {
      console.error('Failed to resolve approval', e);
    }
  };

  const clearQuestion = () => setAgentQuestion(null);

  return {
    activeApproval,
    agentQuestion,
    resolveApproval,
    clearQuestion
  };
}
