import { WebSocket, WebSocketServer } from "ws";

/** Map of all currently-connected browser clients */
const clients = new Set<WebSocket>();

/** Map of pending approvals: requestId -> { resolve, reject } */
const pendingApprovals = new Map<string, { resolve: (v: 'approved' | 'denied') => void }>();

export function setupWsManager(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });
}

const broadcastListeners = new Set<(event: any) => void>();

export function addBroadcastListener(listener: (event: any) => void) {
  broadcastListeners.add(listener);
}

export function removeBroadcastListener(listener: (event: any) => void) {
  broadcastListeners.delete(listener);
}

/** Broadcast a JSON message to all connected clients */
export function broadcast(event: object) {
  const msg = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
  for (const listener of broadcastListeners) {
    try {
      listener(event);
    } catch (e) {
      console.error('Broadcast listener error:', e);
    }
  }
}

/**
 * Push an approval request to the frontend and wait for the user's decision.
 * Resolves with 'approved' or 'denied'.
 */
export function requestApprovalFromUser(requestId: string, reason: string): Promise<'approved' | 'denied'> {
  return new Promise((resolve) => {
    pendingApprovals.set(requestId, { resolve });
    broadcast({ type: "approval_needed", requestId, reason });

    // Auto-deny after 120 seconds if no response
    setTimeout(() => {
      if (pendingApprovals.has(requestId)) {
        pendingApprovals.delete(requestId);
        resolve("denied");
      }
    }, 120_000);
  });
}

/** Called by the approval API endpoint */
export function resolveApproval(requestId: string, decision: 'approved' | 'denied'): boolean {
  const pending = pendingApprovals.get(requestId);
  if (!pending) return false;
  pendingApprovals.delete(requestId);
  pending.resolve(decision);
  broadcast({ type: "approval_resolved", requestId, decision });
  return true;
}
