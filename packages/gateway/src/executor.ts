import { WebSocket } from 'ws';
import chalk from 'chalk';
import { Agent, type AgentEvent } from '@mariozechner/pi-agent-core';
import { getModel } from '@mariozechner/pi-ai';
import { GatewayMessage, AuthMessage, EventMessage, ToolCallMessage, ToolResultMessage } from './types.js';

/**
 * Executor connects to the Gateway as a 'node' and runs the AI agent loop.
 */
export class Executor {
	private ws?: WebSocket;
	private agent: Agent;
	private heartbeatInterval?: NodeJS.Timeout;

	constructor(private url: string, private token: string) {
		this.agent = new Agent({
			initialState: {
				model: getModel('anthropic', 'claude-3-5-sonnet-latest'),
				systemPrompt: 'You are an autonomous AI agent. Execute tasks accurately. Use tools when necessary.'
			}
		});

		this.connect();

		this.agent.subscribe((event: AgentEvent) => {
			this.handleAgentEvent(event);
		});
	}

	private connect() {
		console.log(chalk.blue(`[Executor] Connecting to ${this.url}...`));
		this.ws = new WebSocket(this.url);

		this.ws.on('open', () => {
			this.authenticate();
			this.startHeartbeat();
		});

		this.ws.on('message', (data) => {
			try {
				const message = JSON.parse(data.toString()) as GatewayMessage;
				this.handleMessage(message);
			} catch (err) {
				console.error(chalk.red('[Executor] Message parse error:'), err);
			}
		});

		this.ws.on('close', () => {
			console.log(chalk.yellow('[Executor] Connection lost. Retrying in 5s...'));
			this.stopHeartbeat();
			setTimeout(() => this.connect(), 5000);
		});

		this.ws.on('error', (err) => {
			console.error(chalk.red('[Executor] WebSocket error:'), err);
		});
	}

	private authenticate() {
		const auth: AuthMessage = {
			type: 'auth',
			id: `auth-node-${Math.random().toString(36).substring(7)}`,
			token: this.token,
			role: 'node'
		};
		this.send(auth);
	}

	private startHeartbeat() {
		this.heartbeatInterval = setInterval(() => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.ws.ping();
			}
		}, 30000);
	}

	private stopHeartbeat() {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
		}
	}

	private handleMessage(message: GatewayMessage) {
		switch (message.type) {
			case 'event':
				this.handleEvent(message as EventMessage);
				break;
			case 'tool_result':
				this.handleToolResult(message as ToolResultMessage);
				break;
		}
	}

	private async handleEvent(event: EventMessage) {
		console.log(chalk.cyan(`[Executor] Event: ${event.text}`));
		try {
			await this.agent.prompt(event.text);
		} catch (err) {
			console.error(chalk.red('[Executor] Agent prompt error:'), err);
		}
	}

	private async handleToolResult(message: ToolResultMessage) {
		console.log(chalk.green(`[Executor] Tool result: ${message.id}`));
		try {
			// In a more complex setup, we would resume the specific agent loop.
			// This is a simplified version that continues the current prompt.
			this.agent.appendMessage({
				role: 'toolResult',
				toolCallId: message.id,
				content: [{ type: 'text', text: message.result }],
				timestamp: Date.now()
			} as any);

			await this.agent.continue();
		} catch (err) {
			console.error(chalk.red('[Executor] Continuation error:'), err);
		}
	}

	private handleAgentEvent(event: AgentEvent) {
		switch (event.type) {
			case 'message_update':
			case 'message_end': {
				const text = (event.message.content as any[])
					.filter(c => c.type === 'text')
					.map(c => c.text)
					.join('');

				if (text) {
					this.send({
						type: 'response',
						id: Math.random().toString(36).substring(7),
						text,
						done: event.type === 'message_end'
					} as any);
				}
				break;
			}

			case 'tool_execution_start':
				this.send({
					type: 'tool_call',
					id: event.toolCallId,
					toolName: event.toolName,
					args: event.args
				} as ToolCallMessage);
				break;

			case 'agent_end':
				console.log(chalk.blue('[Executor] Agent idle'));
				break;
		}
	}

	private send(message: GatewayMessage) {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		}
	}
}
