import { WebSocketServer, WebSocket } from 'ws';
import chalk from 'chalk';
import { GatewayMessage, AuthMessage, Session } from './types.js';
import { Storage, MemoryStorage, SupabaseStorage } from './storage.js';

interface Client {
	ws: WebSocket;
	role: 'channel' | 'node';
	token: string;
	sessionId?: string;
}

/**
 * Gateway is the central control plane for routing messages between
 * platform channels (Slack, Discord) and execution nodes (Agent Runners).
 */
export class Gateway {
	private wss: WebSocketServer;
	private clients: Map<WebSocket, Client> = new Map();
	private storage: Storage;
	private sharedSecret: string;

	constructor(port: number = 18789) {
		const supabaseUrl = process.env.SUPABASE_URL;
		const supabaseKey = process.env.SUPABASE_KEY;
		this.sharedSecret = process.env.GATEWAY_TOKEN || 'openclaw-default-secret';

		if (supabaseUrl && supabaseKey) {
			console.log(chalk.blue('[Gateway] Using Supabase persistence'));
			this.storage = new SupabaseStorage(supabaseUrl, supabaseKey);
		} else {
			console.log(chalk.yellow('[Gateway] Using in-memory storage'));
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
				console.error(chalk.red('[Gateway] Message error:'), err);
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
		const client = this.clients.get(ws);

		if (!client && message.type !== 'auth') {
			this.sendError(ws, 'Unauthorized. Please send auth message first.');
			return;
		}

		if (client && message.sessionId) {
			client.sessionId = message.sessionId;
		}

		// Persistence logic
		if (message.sessionId) {
			if (message.type === 'event') {
				const event = message as any;
				const session = await this.storage.getSession(message.sessionId);
				if (!session) {
					await this.storage.createSession({
						id: message.sessionId,
						channelId: event.channelId || 'unknown',
						userId: event.userId || 'unknown',
						history: []
					});
				}
			}
			await this.storage.saveMessage(message.sessionId, message);
		}

		// Routing logic
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
				console.warn(chalk.gray(`[Gateway] Ignored: ${message.type}`));
		}
	}

	private authenticate(ws: WebSocket, message: AuthMessage) {
		if (message.token !== this.sharedSecret) {
			console.log(chalk.red(`[Gateway] Auth failed for ${message.role}`));
			this.sendError(ws, 'Invalid token');
			ws.close();
			return;
		}

		this.clients.set(ws, {
			ws,
			role: message.role,
			token: message.token
		});
		console.log(chalk.green(`[Gateway] Authenticated ${message.role}`));
		ws.send(JSON.stringify({ type: 'auth', status: 'ok', id: message.id }));
	}

	private routeToSession(role: 'channel' | 'node', sessionId: string, message: GatewayMessage) {
		const payload = JSON.stringify(message);
		let delivered = false;

		for (const client of this.clients.values()) {
			if (client.role === role && client.ws.readyState === WebSocket.OPEN) {
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

	private sendError(ws: WebSocket, message: string) {
		ws.send(JSON.stringify({ type: 'error', message }));
	}

	public stop() {
		this.wss.close();
	}
}
