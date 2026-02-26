import { getOAuthProviders, getProviders } from "@mariozechner/pi-ai";
import {
	Container,
	type Focusable,
	getEditorKeybindings,
	Input,
	Spacer,
	Text,
	TruncatedText,
	type TUI,
} from "@mariozechner/pi-tui";
import type { AuthStorage } from "../../../core/auth-storage.js";
import type { ModelRegistry } from "../../../core/model-registry.js";
import type { SettingsManager } from "../../../core/settings-manager.js";
import { theme } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";
import { LoginDialogComponent } from "./login-dialog.js";

/**
 * Onboarding component - guides user through initial setup
 */
export class OnboardingComponent extends Container implements Focusable {
	private listContainer: Container;
	private items: { id: string; name: string; type: "oauth" | "api_key"; configured: boolean }[] = [];
	private selectedIndex = 0;
	private tui: TUI;

	private _focused = false;
	get focused(): boolean {
		return this._focused;
	}
	set focused(value: boolean) {
		this._focused = value;
	}

	constructor(
		tui: TUI,
		private authStorage: AuthStorage,
		private modelRegistry: ModelRegistry,
		_settingsManager: SettingsManager,
		private onComplete: () => void,
		_onCancel: () => void,
		private requestRender: () => void,
	) {
		super();
		this.tui = tui;

		this.refreshItems();

		// Top border
		this.addChild(new DynamicBorder());
		this.addChild(new Spacer(1));

		// Title
		this.addChild(new TruncatedText(theme.bold("Welcome to Pi! Let's set up your LLM providers."), 1, 0));
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("dim", "Select a provider to configure:"), 1, 0));
		this.addChild(new Spacer(1));

		// List container
		this.listContainer = new Container();
		this.addChild(this.listContainer);

		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("dim", "Press Enter to configure, Esc to finish setup."), 1, 0));

		// Bottom border
		this.addChild(new DynamicBorder());

		this.updateList();
	}

	private refreshItems(): void {
		const oauthProviders = getOAuthProviders();
		const _allProviders = getProviders();

		const configured = this.authStorage.list();

		this.items = [];

		// OAuth providers first
		for (const p of oauthProviders) {
			this.items.push({
				id: p.id,
				name: p.name,
				type: "oauth",
				configured: configured.includes(p.id) && this.authStorage.get(p.id)?.type === "oauth",
			});
		}

		// API key providers
		const apiKeyProviders = [
			{ id: "openai", name: "OpenAI" },
			{ id: "anthropic", name: "Anthropic (API Key)" },
			{ id: "google", name: "Google Gemini" },
			{ id: "poe", name: "Poe (p-b cookie)" },
			{ id: "groq", name: "Groq" },
			{ id: "mistral", name: "Mistral" },
		];

		for (const p of apiKeyProviders) {
			if (!this.items.find((i) => i.id === p.id)) {
				this.items.push({
					id: p.id,
					name: p.name,
					type: "api_key",
					configured: configured.includes(p.id) && this.authStorage.get(p.id)?.type === "api_key",
				});
			}
		}
	}

	private updateList(): void {
		this.listContainer.clear();

		for (let i = 0; i < this.items.length; i++) {
			const item = this.items[i];
			const isSelected = i === this.selectedIndex;
			const statusIndicator = item.configured ? theme.fg("success", " ✓ configured") : "";

			let line = "";
			if (isSelected) {
				const prefix = theme.fg("accent", "→ ");
				const text = theme.fg("accent", item.name);
				line = prefix + text + statusIndicator;
			} else {
				const text = `  ${item.name}`;
				line = text + statusIndicator;
			}

			this.listContainer.addChild(new TruncatedText(line, 0, 0));
		}
	}

	handleInput(keyData: string): void {
		const kb = getEditorKeybindings();

		if (kb.matches(keyData, "selectUp")) {
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
			this.updateList();
			this.requestRender();
		} else if (kb.matches(keyData, "selectDown")) {
			this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
			this.updateList();
			this.requestRender();
		} else if (kb.matches(keyData, "selectConfirm")) {
			const item = this.items[this.selectedIndex];
			if (item.type === "oauth") {
				this.startOAuthLogin(item.id);
			} else {
				this.startApiKeyInput(item.id, item.name);
			}
		} else if (kb.matches(keyData, "selectCancel")) {
			this.onComplete();
		}
	}

	private async startOAuthLogin(providerId: string): Promise<void> {
		const dialog = new LoginDialogComponent(this.tui, providerId, (success, _message) => {
			this.tui.removeChild(dialog);
			this.tui.setFocus(this);
			if (success) {
				this.refreshItems();
				this.updateList();
			}
			this.requestRender();
		});

		this.tui.addChild(dialog);
		this.tui.setFocus(dialog);

		// Trigger login flow via modelRegistry/authStorage
		try {
			const provider = getOAuthProviders().find((p) => p.id === providerId)!;
			const credentials = await provider.login({
				onAuth: (info) => dialog.showAuth(info.url, info.instructions),
				onPrompt: (prompt) => dialog.showPrompt(prompt.message, prompt.placeholder),
				onProgress: (msg) => dialog.showProgress(msg),
				onManualCodeInput: provider.usesCallbackServer
					? () => dialog.showManualInput("Paste code here:")
					: undefined,
				signal: dialog.signal,
			});

			this.authStorage.set(providerId, { type: "oauth", ...credentials });
			this.modelRegistry.refresh();
			// Re-call completion with success
			(dialog as any).onComplete(true);
		} catch (error: any) {
			if (error.name !== "AbortError") {
				(dialog as any).onComplete(false, error.message);
			}
		}
	}

	private async startApiKeyInput(providerId: string, providerName: string): Promise<void> {
		const input = new Input();
		const container = new Container();
		container.addChild(new DynamicBorder());
		container.addChild(new Text(theme.fg("warning", `Enter API Key for ${providerName}`), 1, 0));
		container.addChild(new Spacer(1));
		container.addChild(input);
		container.addChild(new Text(`(Esc to cancel, Enter to save)`, 1, 0));
		container.addChild(new DynamicBorder());

		this.tui.addChild(container);
		this.tui.setFocus(input);
		this.requestRender();

		input.onSubmit = () => {
			const key = input.getValue().trim();
			if (key) {
				this.authStorage.set(providerId, { type: "api_key", key });
				this.modelRegistry.refresh();
			}
			this.tui.removeChild(container);
			this.tui.setFocus(this);
			this.refreshItems();
			this.updateList();
			this.requestRender();
		};

		input.onEscape = () => {
			this.tui.removeChild(container);
			this.tui.setFocus(this);
			this.requestRender();
		};
	}
}
