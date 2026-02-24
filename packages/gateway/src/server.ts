import { WebSocketServer, WebSocket } from 'ws';
import chalk from 'chalk';
import { GatewayMessage, AuthMessage, Session } from './types.js';

interface Client {
	ws: WebSocket;
	role: 'channel' | 'node';
	token: string;
}

/**
 * Gateway is the central control plane for routing messages between
 * platform channels (Slack, Discord) and execution nodes (Agent Runners).
 */
export class Gateway {
	private wss: WebSocketServer;
	private clients: Map<WebSocket, Client> = new Map();
	private sessions: Map<string, Session> = new Map();

	constructor(port: number = 18789) {
		this.wss = new WebSocketServer({ port });
		this.wss.on('connection', (ws) => this.handleConnection(ws));
		console.log(chalk.bold.green(`[Gateway] Control plane active on ws://localhost:${port}`));
	}

	private handleConnection(ws: WebSocket) {
		ws.on('message', (data) => {
			try {
				const message = JSON.parse(data.toString()) as GatewayMessage;
				this.handleMessage(ws, message);
			} catch (err) {
				console.error(chalk.red('[Gateway] Parse error:'), err);
				ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON protocol' }));
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

	private handleMessage(ws: WebSocket, message: GatewayMessage) {
		const client = this.clients.get(ws);

		if (!client && message.type !== 'auth') {
			ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized. Authenticate first.' }));
			return;
		}

		switch (message.type) {
			case 'auth':
				this.authenticate(ws, message as AuthMessage);
				break;
			case 'event':
				this.routeToRole('node', message);
				break;
			case 'tool_call':
				this.routeToRole('channel', message);
				break;
			case 'tool_result':
				this.routeToRole('node', message);
				break;
			case 'response':
				this.routeToRole('channel', message);
				break;
			default:
				console.warn(chalk.gray(`[Gateway] Unhandled message type: ${message.type}`));
		}
	}

	private authenticate(ws: WebSocket, message: AuthMessage) {
		// Mock authentication logic - accept any token for now
		this.clients.set(ws, {
			ws,
			role: message.role,
			token: message.token
		});
		console.log(chalk.green(`[Gateway] Authenticated ${message.role}`));
		ws.send(JSON.stringify({ type: 'auth', status: 'ok', id: message.id }));
	}

	private routeToRole(role: 'channel' | 'node', message: GatewayMessage) {
		const payload = JSON.stringify(message);
		let delivered = false;

		for (const client of this.clients.values()) {
			if (client.role === role && client.ws.readyState === WebSocket.OPEN) {
				client.ws.send(payload);
				delivered = true;
			}
		}

		if (!delivered) {
			console.warn(chalk.yellow(`[Gateway] Message ${message.type} could not be delivered to any ${role}`));
		}
	}

	public stop() {
		this.wss.close();
		console.log(chalk.blue('[Gateway] Server stopped'));
	}
}
