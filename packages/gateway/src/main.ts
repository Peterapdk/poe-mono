import { Gateway } from './server.js';
import { Executor } from './executor.js';

const mode = process.argv[2] || 'server';

if (mode === 'server') {
	new Gateway();
} else if (mode === 'executor') {
	const url = process.env.GATEWAY_URL || 'ws://localhost:18789';
	const token = process.env.GATEWAY_TOKEN || 'default-token';
	new Executor(url, token);
} else {
	console.log('Usage: node main.js [server|executor]');
}
