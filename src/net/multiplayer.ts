// Minimal multiplayer client for "Hold the Line".
// Set VITE_WS_URL to your Render relay, e.g. wss://hold-the-line-relay.onrender.com

export type MPMessage =
  | { type: 'joined'; playerId: string; room: string; peers: number }
  | { type: 'peer-joined'; playerId: string }
  | { type: 'peer-left'; playerId: string }
  | { type: 'peer-state'; playerId: string; payload: unknown }
  | { type: 'chat'; playerId: string; text: string };

export interface MPConnection {
  send: (msg: unknown) => void;
  close: () => void;
}

export function connectMultiplayer(
  roomCode: string,
  onMessage: (msg: MPMessage) => void,
): MPConnection | null {
  const url = (import.meta as { env?: { VITE_WS_URL?: string } }).env?.VITE_WS_URL;
  if (!url) {
    console.warn('VITE_WS_URL not set; multiplayer disabled');
    return null;
  }
  const ws = new WebSocket(url);
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'join', room: roomCode }));
  };
  ws.onmessage = (ev) => {
    try {
      onMessage(JSON.parse(ev.data) as MPMessage);
    } catch {
      /* ignore */
    }
  };
  return {
    send: (msg) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close: () => ws.close(),
  };
}
