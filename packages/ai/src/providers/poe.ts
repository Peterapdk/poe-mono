import { getEnvApiKey } from "../env-api-keys.js";
import type { Context, Model, SimpleStreamOptions, StreamFunction, StreamOptions } from "../types.js";
import type { AssistantMessageEventStream } from "../utils/event-stream.js";
import { streamOpenAICompletions, streamSimpleOpenAICompletions } from "./openai-completions.js";

export interface PoeOptions extends StreamOptions {}

/**
 * Poe provider implementation.
 * Currently uses OpenAI-compatible completions logic but ensures p-b cookie is handled.
 */
export const streamPoe: StreamFunction<"poe-chat", PoeOptions> = (
	model: Model<"poe-chat">,
	context: Context,
	options?: PoeOptions,
): AssistantMessageEventStream => {
	const apiKey = options?.apiKey ?? getEnvApiKey("poe") ?? "";

	// Merge Poe cookie into headers
	const headers = {
		...options?.headers,
		...(apiKey ? { Cookie: `p-b=${apiKey}` } : {}),
	};

	// Reuse OpenAI completions logic
	return streamOpenAICompletions(
		{
			...model,
			api: "openai-completions",
		} as any,
		context,
		{
			...options,
			headers,
		},
	);
};

export const streamSimplePoe: StreamFunction<"poe-chat", SimpleStreamOptions> = (
	model: Model<"poe-chat">,
	context: Context,
	options?: SimpleStreamOptions,
): AssistantMessageEventStream => {
	const apiKey = options?.apiKey ?? getEnvApiKey("poe") ?? "";

	const headers = {
		...options?.headers,
		...(apiKey ? { Cookie: `p-b=${apiKey}` } : {}),
	};

	return streamSimpleOpenAICompletions(
		{
			...model,
			api: "openai-completions",
		} as any,
		context,
		{
			...options,
			headers,
		},
	);
};
