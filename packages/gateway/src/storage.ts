import { GatewayMessage, Session } from './types.js';

/**
 * Storage interface for persisting session data and message history.
 */
export interface Storage {
	saveMessage(sessionId: string, message: GatewayMessage): Promise<void>;
	getMessages(sessionId: string): Promise<GatewayMessage[]>;
	createSession(session: Session): Promise<void>;
	getSession(sessionId: string): Promise<Session | null>;
}

/**
 * In-memory storage implementation for local development and testing.
 */
export class MemoryStorage implements Storage {
	private sessions: Map<string, Session> = new Map();

	async saveMessage(sessionId: string, message: GatewayMessage): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.history.push(message);
		}
	}

	async getMessages(sessionId: string): Promise<GatewayMessage[]> {
		return this.sessions.get(sessionId)?.history || [];
	}

	async createSession(session: Session): Promise<void> {
		this.sessions.set(session.id, { ...session, history: session.history || [] });
	}

	async getSession(sessionId: string): Promise<Session | null> {
		return this.sessions.get(sessionId) || null;
	}
}

/**
 * SupabaseStorage uses the Supabase REST API (PostgREST) to persist data.
 * Designed for serverless/cloud deployments (Supabase, Neon).
 */
export class SupabaseStorage implements Storage {
	constructor(private url: string, private key: string) {}

	private async request(path: string, options: RequestInit = {}) {
		const response = await fetch(`${this.url}${path}`, {
			...options,
			headers: {
				'apikey': this.key,
				'Authorization': `Bearer ${this.key}`,
				'Content-Type': 'application/json',
				...options.headers,
			},
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Storage request failed: ${response.status} ${error}`);
		}

		return response;
	}

	async saveMessage(sessionId: string, message: GatewayMessage): Promise<void> {
		await this.request('/rest/v1/messages', {
			method: 'POST',
			body: JSON.stringify({
				session_id: sessionId,
				data: message,
				type: message.type
			}),
			headers: { 'Prefer': 'return=minimal' }
		});
	}

	async getMessages(sessionId: string): Promise<GatewayMessage[]> {
		try {
			const res = await this.request(`/rest/v1/messages?session_id=eq.${sessionId}&select=data`);
			const rows = await res.json() as Array<{ data: GatewayMessage }>;
			return rows.map(r => r.data);
		} catch (err) {
			console.error(`[SupabaseStorage] Failed to get messages for ${sessionId}:`, err);
			return [];
		}
	}

	async createSession(session: Session): Promise<void> {
		await this.request('/rest/v1/sessions', {
			method: 'POST',
			body: JSON.stringify({
				id: session.id,
				channel_id: session.channelId,
				user_id: session.userId
			}),
			headers: { 'Prefer': 'return=minimal' }
		});
	}

	async getSession(sessionId: string): Promise<Session | null> {
		try {
			const res = await this.request(`/rest/v1/sessions?id=eq.${sessionId}&select=*`);
			const rows = await res.json() as any[];
			if (rows.length === 0) return null;

			const history = await this.getMessages(sessionId);
			return {
				id: rows[0].id,
				channelId: rows[0].channel_id,
				userId: rows[0].user_id,
				history
			};
		} catch (err) {
			console.error(`[SupabaseStorage] Failed to get session ${sessionId}:`, err);
			return null;
		}
	}
}
