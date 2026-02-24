import { WebSocket } from 'ws';
import chalk from 'chalk';
import { GatewayMessage, AuthMessage, EventMessage } from '../src/types.js';

export class MockChannel {
	private ws: WebSocket;

	constructor(url: string, token: string) {
		this.ws = new WebSocket(url);

		this.ws.on('open', () => {
			console.log(chalk.blue('MockChannel connected'));
			this.authenticate(token);
		});

		this.ws.on('message', (data) => {
			const message = JSON.parse(data.toString()) as GatewayMessage;
			console.log(chalk.magenta('MockChannel received:'), message.type);
			if (message.type === 'response') {
				console.log(chalk.green('Agent Response:'), (message as any).text);
			}
		});
	}

	private authenticate(token: string) {
		const auth: AuthMessage = {
			type: 'auth',
			id: 'auth-channel-1',
			token,
			role: 'channel'
		};
		this.send(auth);
	}

	public sendEvent(text: string) {
		const event: EventMessage = {
			type: 'event',
			id: `evt-${Date.now()}`,
			channelId: 'mock-channel-1',
			userId: 'user-1',
			text
		};
		this.send(event);
	}

	private send(message: any) {
		this.ws.send(JSON.stringify(message));
	}
}
