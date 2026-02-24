import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Gateway } from '../src/server.js';
import { WebSocket } from 'ws';

describe('Gateway', () => {
	let gateway: Gateway;
	const port = 18790;
	const token = 'openclaw-default-secret';

	beforeAll(() => {
		process.env.GATEWAY_TOKEN = token;
		gateway = new Gateway(port);
	});

	afterAll(() => {
		gateway.stop();
	});

	it('should allow channel and node to authenticate', async () => {
		const channelWs = new WebSocket(`ws://localhost:${port}`);
		const nodeWs = new WebSocket(`ws://localhost:${port}`);

		const authChannel = new Promise((resolve) => {
			channelWs.on('open', () => {
				channelWs.send(JSON.stringify({ type: 'auth', id: '1', token, role: 'channel' }));
			});
			channelWs.on('message', (data) => {
				const msg = JSON.parse(data.toString());
				if (msg.type === 'auth' && msg.status === 'ok') resolve(true);
			});
		});

		const authNode = new Promise((resolve) => {
			nodeWs.on('open', () => {
				nodeWs.send(JSON.stringify({ type: 'auth', id: '2', token, role: 'node' }));
			});
			nodeWs.on('message', (data) => {
				const msg = JSON.parse(data.toString());
				if (msg.type === 'auth' && msg.status === 'ok') resolve(true);
			});
		});

		await expect(authChannel).resolves.toBe(true);
		await expect(authNode).resolves.toBe(true);

		channelWs.close();
		nodeWs.close();
	});

	it('should route events from channel to node via sessionId', async () => {
		const channelWs = new WebSocket(`ws://localhost:${port}`);
		const nodeWs = new WebSocket(`ws://localhost:${port}`);
		const sessionId = 'test-session';

		await new Promise((resolve) => {
			channelWs.on('open', () => {
				channelWs.send(JSON.stringify({ type: 'auth', id: '1', token, role: 'channel' }));
				resolve(true);
			});
		});

		await new Promise((resolve) => {
			nodeWs.on('open', () => {
				nodeWs.send(JSON.stringify({ type: 'auth', id: '2', token, role: 'node' }));
				resolve(true);
			});
		});

		const eventReceived = new Promise((resolve) => {
			nodeWs.on('message', (data) => {
				const msg = JSON.parse(data.toString());
				if (msg.type === 'event' && msg.sessionId === sessionId) resolve(msg.text);
			});
		});

		channelWs.send(JSON.stringify({
			type: 'event',
			id: '3',
			sessionId,
			channelId: 'c1',
			userId: 'u1',
			text: 'hello agent'
		}));

		await expect(eventReceived).resolves.toBe('hello agent');

		channelWs.close();
		nodeWs.close();
	});
});
