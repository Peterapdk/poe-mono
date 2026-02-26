import type { OAuthCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from "./types.js";

export const poeOAuthProvider: OAuthProviderInterface = {
	id: "poe",
	name: "Poe (p-b cookie)",
	usesCallbackServer: false,

	async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
		const cookie = await callbacks.onPrompt({
			message: "Enter your Poe 'p-b' cookie:",
			placeholder: "p-b=...",
		});

		if (!cookie) {
			throw new Error("Poe cookie is required");
		}

		// Normalize cookie if needed: extract p-b value if full cookie string provided
		let p_b = cookie.trim();
		if (p_b.includes("p-b=")) {
			const match = p_b.match(/p-b=([^;]+)/);
			if (match) {
				p_b = match[1];
			}
		}

		return {
			access: p_b,
			refresh: "", // Poe doesn't have refresh tokens in this flow
			expires: Date.now() + 30 * 24 * 60 * 60 * 1000, // Assume 30 days
			p_b: p_b,
		};
	},

	async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
		// Cannot refresh p-b cookie automatically
		return credentials;
	},

	getApiKey(credentials: OAuthCredentials): string {
		return credentials.access;
	},
};
