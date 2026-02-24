import { WebSocketServer, WebSocket } from 'ws';
import chalk from 'chalk';
import { GatewayMessage, AuthMessage, Session } from './types.js';
import { Storage, MemoryStorage, SupabaseStorage } from './storage.js';

interface Client {
	ws: WebSocket;
	role: 'channel' | 'node';
	token: string;
	sessionId?: string; // Associated session for this connection
}

export class Gateway {
	private wss: WebSocketServer;
	private clients: Map<WebSocket, Client> = new Map();
	private storage: Storage;

	constructor(port: number = 18789) {
		const supabaseUrl = process.env.SUPABASE_URL;
		const supabaseKey = process.env.SUPABASE_KEY;

		if (supabaseUrl && supabaseKey) {
			console.log(chalk.blue('[Gateway] Using Supabase for persistent storage'));
			this.storage = new SupabaseStorage(supabaseUrl, supabaseKey);
		} else {
			console.log(chalk.yellow('[Gateway] Using in-memory storage (non-persistent)'));
			this.storage = new MemoryStorage();
		}

		this.wss = new WebSocketServer({ port });
		this.wss.on('connection', (ws) => this.handleConnection(ws));
		console.log(chalk.bold.green(`[Gateway] Control plane active on ws://localhost:${port}`));
	}

	private handleConnection(ws: WebSocket) {
		ws.on('message', async (data) => {
			try {
				const message = JSON.parse(data.toString()) as GatewayMessage;
				await this.handleMessage(ws, message);
			} catch (err) {
				console.error(chalk.red('[Gateway] Message processing error:'), err);
			}
		});

		ws.on('close', () => {
			const client = this.clients.get(ws);
			if (client) {
				console.log(chalk.yellow(`[Gateway] ${client.role} disconnected`));
				this.clients.delete(ws);
			}
		});
	}

	private async handleMessage(ws: WebSocket, message: GatewayMessage) {
		let client = this.clients.get(ws);

		if (!client && message.type !== 'auth') {
			ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
			return;
		}

		// Update client's current session if provided
		if (client && message.sessionId) {
			client.sessionId = message.sessionId;
		}

		// Ensure session exists BEFORE saving message
		if (message.sessionId && message.type === 'event') {
			const event = message as any;
			const session = await this.storage.getSession(message.sessionId);
			if (!session) {
				await this.storage.createSession({
					id: message.sessionId,
					channelId: event.channelId,
					userId: event.userId,
					history: []
				});
			}
		}

		// Persist message
		if (message.sessionId) {
			await this.storage.saveMessage(message.sessionId, message);
		}

		switch (message.type) {
			case 'auth':
				this.authenticate(ws, message as AuthMessage);
				break;
			case 'event':
				this.routeToSession('node', message.sessionId!, message);
				break;
			case 'tool_call':
				this.routeToSession('channel', message.sessionId!, message);
				break;
			case 'tool_result':
				this.routeToSession('node', message.sessionId!, message);
				break;
			case 'response':
				this.routeToSession('channel', message.sessionId!, message);
				break;
			default:
				console.warn(chalk.gray(`[Gateway] Unhandled: ${message.type}`));
		}
	}

	private authenticate(ws: WebSocket, message: AuthMessage) {
		this.clients.set(ws, {
			ws,
			role: message.role,
			token: message.token
		});
		console.log(chalk.green(`[Gateway] Authenticated ${message.role}`));
		ws.send(JSON.stringify({ type: 'auth', status: 'ok', id: message.id }));
	}

	/**
	 * Routes a message to all clients of a specific role that are interested in a session.
	 * In a real-world scenario, you'd probably have 1 Node per Session.
	 */
	private routeToSession(role: 'channel' | 'node', sessionId: string, message: GatewayMessage) {
		const payload = JSON.stringify(message);
		let delivered = false;
		for (const client of this.clients.values()) {
			if (client.role === role && client.ws.readyState === WebSocket.OPEN) {
				// If client has specified a session, only send if it matches.
				// Otherwise, if it's a new Node or Channel looking for work, broadcast (simplified).
				if (!client.sessionId || client.sessionId === sessionId) {
					client.ws.send(payload);
					delivered = true;
				}
			}
		}
		if (!delivered) {
			console.warn(chalk.yellow(`[Gateway] No ${role} available for session ${sessionId}`));
		}
	}

	public stop() {
		this.wss.close();
	}
}
