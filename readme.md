# SillyTavern Magic Translation

A [SillyTavern](https://docs.sillytavern.app/) extension that provides real-time translation of chat messages using your configured Language Model APIs.

![settings](images/settings.png)

## Features

*   **Real-time Translation:** Translate chat messages using any configured LLM.
*   **Configurable API:** Uses SillyTavern's built-in [Connection Profiles](https://docs.sillytavern.app/usage/core-concepts/connection-profiles/).
*   **Customizable Prompts:** Create and manage multiple prompt presets to fine-tune translation results.
*   **Automatic Translation:** Automatically translate incoming responses, outgoing messages, or both.
*   **Manual Translation:** On-demand translation via a button on each message or with slash commands.
*   **Slash Commands:**
    *   `/magic-translate [message_id]`: Translates a specific message. Defaults to the last message.
    *   `/magic-translate-text <text>`: Translates any text you provide.

## Installation

Install via the SillyTavern extension installer:

```txt
https://github.com/bmen25124/SillyTavern-Magic-Translation
```

## How to Use

1.  **Configure a Connection Profile:**
    *   Go to the **API Settings** tab (the plug icon on the top bar).
    *   Set up a **Connection Profile** for the LLM you want to use for translation. This is the same as setting up a profile for a character to chat with.

2.  **Configure Translation Settings:**
    *   Go to the **Extensions** tab (the plug icon on the right sidebar) and find the **Magic Translation** settings panel.
    *   **Connection Profile:** Select the profile you configured in the previous step.
    *   **Target Language:** Choose the language you want messages translated into.
    *   **Auto Mode:** Select if you want automatic translation for incoming messages (`Responses`), outgoing messages (`Inputs`), or `Both`. Leave as `None` for manual-only translation.

3.  **Translate Messages:**
    *   **Manual:** Click the **globe icon** on any chat message to translate it.
    *   **Automatic:** If Auto Mode is enabled, messages will be translated automatically based on your settings.
    *   **Slash Command:** Use `/magic-translate` or `/magic-translate-text` in the chat input.

## Settings Explained

*   **Connection Profile:** The LLM profile used for translation.
*   **Prompt Presets:** Manage different prompts for translation. You can create, rename, and delete presets. The `default` preset cannot be deleted.
*   **Prompt:** The instruction template sent to the LLM. Key placeholders:
    *   `{{prompt}}`: The text to be translated.
    *   `{{language}}`: The target language name (e.g., "Spanish").
    *   `{{chat}}`: An array of previous chat messages for context.
*   **Filter Code Block:** If your prompt instructs the LLM to wrap the translation in a code block, this option will automatically extract the text from it.
*   **Target Language:** The language to translate messages into.
*   **Auto Mode:**
    *   `None`: Manual translation only.
    *   `Responses`: Automatically translate messages from the character.
    *   `Inputs`: Automatically translate your messages before sending.
    *   `Both`: Translate both incoming and outgoing messages.

## Troubleshooting

*   **Extension not showing:** Make sure it's installed and enabled in the Extensions tab, then reload SillyTavern.
*   **Translation errors:**
    *   Verify your selected **Connection Profile** is working correctly.
    *   Check the prompt for any issues. Try restoring the default prompt.
    *   Some LLMs may refuse to translate if the content violates their safety policies.
