import { JSONRPCMessageSchema } from "../../src/types.js";
import WebSocket from "ws";
import crypto from "crypto";

/**
 * Server-side WebSocket transport implementation for MCP protocol.
 */
export class WebSocketTransport {
    constructor(ws) {
        this._ws = ws;
        this.sessionId = crypto.randomUUID();
        
        this._ws.on("message", (data) => {
            try {
                const message = JSONRPCMessageSchema.parse(JSON.parse(data.toString()));
                this.onmessage?.(message);
            }
            catch (error) {
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
    async start() {
        // WebSocket is already connected when provided to the constructor
        // No additional startup needed for server-side
    }
    async send(message) {
        if (this._ws.readyState === WebSocket.OPEN) {
            this._ws.send(JSON.stringify(message));
        }
        else {
            throw new Error("WebSocket is not open");
        }
    }
    async close() {
        if (this._ws.readyState === WebSocket.OPEN) {
            this._ws.close();
        }
    }
    /**
     * Process method used for middleware functionality in the examples.
     * This allows intercepting and modifying requests before they're handled.
     */
    async process(request) {
        return request;
    }
}
