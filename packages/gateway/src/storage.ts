import { GatewayMessage, Session } from './types.js';

export interface Storage {
	saveMessage(sessionId: string, message: GatewayMessage): Promise<void>;
	getMessages(sessionId: string): Promise<GatewayMessage[]>;
	createSession(session: Session): Promise<void>;
	getSession(sessionId: string): Promise<Session | null>;
}

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
		this.sessions.set(session.id, session);
	}

	async getSession(sessionId: string): Promise<Session | null> {
		return this.sessions.get(sessionId) || null;
	}
}

/**
 * SupabaseStorage uses the Supabase REST API (PostgREST) via fetch.
 * This avoids the need for the @supabase/supabase-js dependency.
 */
export class SupabaseStorage implements Storage {
	constructor(private url: string, private key: string) {}

	async saveMessage(sessionId: string, message: GatewayMessage): Promise<void> {
		await fetch(`${this.url}/rest/v1/messages`, {
			method: 'POST',
			headers: {
				'apikey': this.key,
				'Authorization': `Bearer ${this.key}`,
				'Content-Type': 'application/json',
				'Prefer': 'return=minimal'
			},
			body: JSON.stringify({
				session_id: sessionId,
				data: message,
				type: message.type
			})
		});
	}

	async getMessages(sessionId: string): Promise<GatewayMessage[]> {
		const res = await fetch(`${this.url}/rest/v1/messages?session_id=eq.${sessionId}&select=data`, {
			headers: {
				'apikey': this.key,
				'Authorization': `Bearer ${this.key}`
			}
		});
		if (!res.ok) return [];
		const rows = await res.json() as Array<{ data: GatewayMessage }>;
		return rows.map(r => r.data);
	}

	async createSession(session: Session): Promise<void> {
		await fetch(`${this.url}/rest/v1/sessions`, {
			method: 'POST',
			headers: {
				'apikey': this.key,
				'Authorization': `Bearer ${this.key}`,
				'Content-Type': 'application/json',
				'Prefer': 'return=minimal'
			},
			body: JSON.stringify({
				id: session.id,
				channel_id: session.channelId,
				user_id: session.userId
			})
		});
	}

	async getSession(sessionId: string): Promise<Session | null> {
		const res = await fetch(`${this.url}/rest/v1/sessions?id=eq.${sessionId}&select=*`, {
			headers: {
				'apikey': this.key,
				'Authorization': `Bearer ${this.key}`
			}
		});
		if (!res.ok) return null;
		const rows = await res.json() as any[];
		if (rows.length === 0) return null;

		const history = await this.getMessages(sessionId);
		return {
			id: rows[0].id,
			channelId: rows[0].channel_id,
			userId: rows[0].user_id,
			history
		};
	}
}
