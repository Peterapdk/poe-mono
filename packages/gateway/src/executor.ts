import { WebSocket } from 'ws';
import chalk from 'chalk';
import { Agent } from '@mariozechner/pi-agent-core';
import { getModel } from '@mariozechner/pi-ai';
import { GatewayMessage, AuthMessage, EventMessage, ToolCallMessage, ToolResultMessage } from './types.js';

/**
 * Executor connects to the Gateway as a 'node' and runs the AI agent loop.
 */
export class Executor {
	private ws: WebSocket;
	private agent: Agent;

	constructor(url: string, token: string) {
		this.ws = new WebSocket(url);
		this.agent = new Agent({
			initialState: {
				model: getModel('anthropic', 'claude-3-5-sonnet-latest'),
				systemPrompt: 'You are an autonomous AI agent. Execute tasks accurately. Use tools when necessary. If you need more information, ask the user.'
			}
		});

		this.ws.on('open', () => this.authenticate(token));
		this.ws.on('message', (data) => this.handleMessage(data));

		this.agent.subscribe((event) => {
			this.handleAgentEvent(event);
		});
	}

	private authenticate(token: string) {
		const auth: AuthMessage = {
			type: 'auth',
			id: `auth-node-${Math.random().toString(36).substring(7)}`,
			token,
			role: 'node'
		};
		this.send(auth);
	}

	private handleMessage(data: any) {
		try {
			const message = JSON.parse(data.toString()) as GatewayMessage;

			switch (message.type) {
				case 'event':
					this.handleEvent(message as EventMessage);
					break;
				case 'tool_result':
					this.handleToolResult(message as ToolResultMessage);
					break;
				case 'error':
					console.error(chalk.red('Gateway error:'), (message as any).message);
					break;
			}
		} catch (err) {
			console.error(chalk.red('Failed to handle gateway message:'), err);
		}
	}

	private async handleEvent(event: EventMessage) {
		console.log(chalk.cyan(`[Executor] Processing event: ${event.text}`));
		try {
			await this.agent.prompt(event.text);
		} catch (err) {
			console.error(chalk.red('[Executor] Agent prompt error:'), err);
			this.sendError(event.id, String(err));
		}
	}

	private async handleToolResult(message: ToolResultMessage) {
		console.log(chalk.green(`[Executor] Tool result received for ${message.id}`));
		try {
			this.agent.appendMessage({
				role: 'toolResult',
				toolCallId: message.id,
				content: [{ type: 'text', text: message.result }],
				timestamp: Date.now()
			} as any);

			await this.agent.continue();
		} catch (err) {
			console.error(chalk.red('[Executor] Error continuing agent after tool result:'), err);
			this.sendError(message.id, String(err));
		}
	}

	private handleAgentEvent(event: any) {
		switch (event.type) {
			case 'message_update':
			case 'message_end':
				const text = event.message.content
					.filter((c: any) => c.type === 'text')
					.map((c: any) => c.text)
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

			case 'tool_call':
				console.log(chalk.yellow(`[Executor] Tool call: ${event.toolName}`));
				this.send({
					type: 'tool_call',
					id: event.toolCallId,
					toolName: event.toolName,
					args: event.args
				} as ToolCallMessage);
				break;

			case 'agent_end':
				console.log(chalk.blue('[Executor] Agent turn finished'));
				break;
		}
	}

	private sendError(id: string, text: string) {
		this.send({
			type: 'error',
			id,
			text,
			done: true
		} as any);
	}

	private send(message: GatewayMessage) {
		if (this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		}
	}
}
