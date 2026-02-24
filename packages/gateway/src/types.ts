export type MessageType = 'auth' | 'event' | 'tool_call' | 'tool_result' | 'response' | 'error';

export interface BaseMessage {
	type: MessageType;
	id: string;
	sessionId?: string;
}

export interface AuthMessage extends BaseMessage {
	type: 'auth';
	token: string;
	role: 'channel' | 'node';
}

export interface EventMessage extends BaseMessage {
	type: 'event';
	channelId: string;
	userId: string;
	text: string;
	attachments?: Array<{
		name: string;
		url: string;
	}>;
}

export interface ToolCallMessage extends BaseMessage {
	type: 'tool_call';
	toolName: string;
	args: Record<string, unknown>;
}

export interface ToolResultMessage extends BaseMessage {
	type: 'tool_result';
	result: string;
	error?: string;
}

export interface ResponseMessage extends BaseMessage {
	type: 'response';
	text: string;
	done: boolean;
}

export type GatewayMessage = AuthMessage | EventMessage | ToolCallMessage | ToolResultMessage | ResponseMessage;

export interface Session {
	id: string;
	channelId: string;
	userId: string;
	history: GatewayMessage[];
}
