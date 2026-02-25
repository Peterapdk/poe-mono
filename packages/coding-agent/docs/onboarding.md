# Onboarding Guide

Pi provides an interactive onboarding flow to help you set up your LLM providers quickly.

## Starting Onboarding

You can trigger onboarding in two ways:

1. **Automatically**: Run `pi` for the first time without any configured API keys or OAuth tokens.
2. **Manually**: Run `pi onboard` from your terminal.
3. **In-Session**: Use the `/onboard` command in interactive mode.

## Supported Providers

The onboarding flow helps you configure both subscription-based (OAuth) and API key-based providers:

### Subscriptions (OAuth)
- **Anthropic Claude Pro/Max**: Direct login to your Anthropic subscription.
- **GitHub Copilot**: Use your Copilot subscription.
- **Google Gemini CLI / Antigravity**: Use Google Cloud's free or paid tiers.
- **OpenAI Codex**: Access GPT-5.x Codex models via ChatGPT Plus/Pro.

### API Keys
- **OpenAI**: Requires `OPENAI_API_KEY`.
- **Anthropic**: Requires `ANTHROPIC_API_KEY`.
- **Google Gemini**: Requires `GEMINI_API_KEY`.
- **Poe**: Requires a Poe session cookie (`p-b`).
- **Groq, Mistral, Cerebras, xAI, OpenRouter**: And more.

## Configuring Poe

To use Poe with Pi, you need to provide your session cookie:

1. Log in to [poe.com](https://poe.com) in your browser.
2. Open Developer Tools (F12 or Cmd+Option+I).
3. Go to the **Application** (Chrome/Edge) or **Storage** (Firefox) tab.
4. Select **Cookies** and find `https://poe.com`.
5. Copy the value of the `p-b` cookie.
6. Paste this value when prompted during onboarding or via `/login poe`.

Alternatively, set the `POE_P_B` environment variable.

## Next Steps

Once configured, your credentials are saved to `~/.pi/agent/auth.json`. You can now:

- Use `/model` or `Ctrl+L` to switch between models.
- Enable/disable specific models for quick cycling via `/scoped-models`.
- Start coding!
