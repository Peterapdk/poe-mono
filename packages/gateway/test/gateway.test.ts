import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Gateway } from '../src/server.js';
import { MockChannel } from './mock-channel.js';
import { WebSocket } from 'ws';

describe('Gateway', () => {
	let gateway: Gateway;
	const port = 18790;

	beforeAll(() => {
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
				channelWs.send(JSON.stringify({ type: 'auth', id: '1', token: 't1', role: 'channel' }));
			});
			channelWs.on('message', (data) => {
				const msg = JSON.parse(data.toString());
				if (msg.type === 'auth' && msg.status === 'ok') resolve(true);
			});
		});

		const authNode = new Promise((resolve) => {
			nodeWs.on('open', () => {
				nodeWs.send(JSON.stringify({ type: 'auth', id: '2', token: 't2', role: 'node' }));
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

	it('should route events from channel to node', async () => {
		const channelWs = new WebSocket(`ws://localhost:${port}`);
		const nodeWs = new WebSocket(`ws://localhost:${port}`);

		await new Promise((resolve) => {
			channelWs.on('open', () => {
				channelWs.send(JSON.stringify({ type: 'auth', id: '1', token: 't1', role: 'channel' }));
				resolve(true);
			});
		});

		await new Promise((resolve) => {
			nodeWs.on('open', () => {
				nodeWs.send(JSON.stringify({ type: 'auth', id: '2', token: 't2', role: 'node' }));
				resolve(true);
			});
		});

		const eventReceived = new Promise((resolve) => {
			nodeWs.on('message', (data) => {
				const msg = JSON.parse(data.toString());
				if (msg.type === 'event' && msg.text === 'hello agent') resolve(msg.text);
			});
		});

		channelWs.send(JSON.stringify({ type: 'event', id: '3', channelId: 'c1', userId: 'u1', text: 'hello agent' }));

		await expect(eventReceived).resolves.toBe('hello agent');

		channelWs.close();
		nodeWs.close();
	});
});
