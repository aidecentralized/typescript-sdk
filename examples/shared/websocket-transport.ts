import { Transport } from "../../src/shared/transport.js";
import { JSONRPCMessage, JSONRPCMessageSchema } from "../../src/types.js";
import WebSocket from "ws";
import crypto from "crypto";

/**
 * Server-side WebSocket transport implementation for MCP protocol.
 */
export class WebSocketTransport implements Transport {
  private _ws: WebSocket;
  
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  sessionId: string;
  user?: unknown;

  constructor(ws: WebSocket) {
    this._ws = ws;
    this.sessionId = crypto.randomUUID();
    
    this._ws.on("message", (data) => {
      try {
        const message = JSONRPCMessageSchema.parse(JSON.parse(data.toString()));
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      }
    });

    this._ws.on("close", () => {
      this.onclose?.();
    });

    this._ws.on("error", (error) => {
      this.onerror?.(error);
    });
  }

  /**
   * No startup needed as the WebSocket is already connected.
   */
  async start(): Promise<void> {
    // WebSocket is already connected when provided to the constructor
  }

  /**
   * Sends a JSON-RPC message over the WebSocket.
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(message));
    } else {
      throw new Error("WebSocket is not open");
    }
  }

  /**
   * Closes the WebSocket connection.
   */
  async close(): Promise<void> {
    if (this._ws.readyState === WebSocket.OPEN) {
      this._ws.close();
    }
  }
  
  /**
   * Processes an incoming request, allowing middleware-like functionality.
   */
  async process(request: JSONRPCMessage): Promise<JSONRPCMessage | void> {
    return request;
  }
}