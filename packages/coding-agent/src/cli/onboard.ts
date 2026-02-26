/**
 * TUI onboarding for `pi onboard` command
 */

import { ProcessTerminal, TUI } from "@mariozechner/pi-tui";
import type { AuthStorage } from "../core/auth-storage.js";
import type { ModelRegistry } from "../core/model-registry.js";
import type { SettingsManager } from "../core/settings-manager.js";
import { OnboardingComponent } from "../modes/interactive/components/onboarding.js";
import { initTheme, stopThemeWatcher } from "../modes/interactive/theme/theme.js";

export interface OnboardingOptions {
	settingsManager: SettingsManager;
	authStorage: AuthStorage;
	modelRegistry: ModelRegistry;
	cwd: string;
	agentDir: string;
}

/** Show TUI onboarding and return when finished */
export async function startOnboarding(options: OnboardingOptions): Promise<void> {
	// Initialize theme before showing TUI
	initTheme(options.settingsManager.getTheme(), true);

	return new Promise((resolve) => {
		const ui = new TUI(new ProcessTerminal());
		let resolved = false;

		const onboard = new OnboardingComponent(
			ui,
			options.authStorage,
			options.modelRegistry,
			options.settingsManager,
			() => {
				if (!resolved) {
					resolved = true;
					ui.stop();
					stopThemeWatcher();
					resolve();
				}
			},
			() => {
				ui.stop();
				stopThemeWatcher();
				process.exit(0);
			},
			() => ui.requestRender(),
		);

		ui.addChild(onboard);
		ui.setFocus(onboard);
		ui.start();
	});
}
