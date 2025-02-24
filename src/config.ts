// @ts-ignore
import { Popup } from '../../../../popup.js';

// @ts-ignore
import { chat_completion_sources } from '../../../../openai.js';

import {
  name1,
  name2,
  CONNECT_API_MAP,
  extractMessageFromData,
  amount_gen,
  max_context,
  // @ts-ignore
} from '../../../../../script.js';

// @ts-ignore
import { getPresetManager } from '../../../../preset-manager.js';

import {
  textgen_types,
  getLogprobsNumber,
  getTextGenServer,
  replaceMacrosInList,
  // @ts-ignore
} from '../../../../textgen-settings.js';

export const extensionName = 'SillyTavern-LLM-Translator';
export const context = SillyTavern.getContext();

/**
 * Sends an echo message using the SlashCommandParser's echo command.
 */
export async function st_echo(severity: string, message: string): Promise<void> {
  // @ts-ignore
  await SillyTavern.getContext().SlashCommandParser.commands['echo'].callback({ severity: severity }, message);
}

/**
 * @returns True if user accepts it.
 */
export async function st_popupConfirm(header: string, text?: string): Promise<boolean> {
  // @ts-ignore
  return await SillyTavern.getContext().Popup.show.confirm(header, text);
}

export function chatCompletionSourceToModel(source: string) {
  switch (source) {
    case chat_completion_sources.CLAUDE:
      return context.chatCompletionSettings.claude_model;
    case chat_completion_sources.OPENAI:
      return context.chatCompletionSettings.openai_model;
    case chat_completion_sources.WINDOWAI:
      return context.chatCompletionSettings.windowai_model;
    case chat_completion_sources.SCALE:
      return '';
    case chat_completion_sources.MAKERSUITE:
      return context.chatCompletionSettings.google_model;
    case chat_completion_sources.OPENROUTER:
      return context.chatCompletionSettings.openrouter_model !== 'OR_Website'
        ? context.chatCompletionSettings.openrouter_model
        : null;
    case chat_completion_sources.AI21:
      return context.chatCompletionSettings.ai21_model;
    case chat_completion_sources.MISTRALAI:
      return context.chatCompletionSettings.mistralai_model;
    case chat_completion_sources.CUSTOM:
      return context.chatCompletionSettings.custom_model;
    case chat_completion_sources.COHERE:
      return context.chatCompletionSettings.cohere_model;
    case chat_completion_sources.PERPLEXITY:
      return context.chatCompletionSettings.perplexity_model;
    case chat_completion_sources.GROQ:
      return context.chatCompletionSettings.groq_model;
    case chat_completion_sources.ZEROONEAI:
      return context.chatCompletionSettings.zerooneai_model;
    case chat_completion_sources.BLOCKENTROPY:
      return context.chatCompletionSettings.blockentropy_model;
    case chat_completion_sources.NANOGPT:
      return context.chatCompletionSettings.nanogpt_model;
    case chat_completion_sources.DEEPSEEK:
      return context.chatCompletionSettings.deepseek_model;
    default:
      throw new Error(`Unknown chat completion source: ${context.chatCompletionSettings.chat_completion_source}`);
  }
}

export function st_getPresetManager(apiId = ''): {
  getPresetList(): {
    presets: any[];
    preset_names: Record<string, number> | string[];
  };
} {
  return getPresetManager(apiId);
}

export function st_getConnectApiMap(): Record<
  string,
  {
    selected: string;
    source?: string;
    type?: string;
  }
> {
  return CONNECT_API_MAP;
}

export function st_extractMessageFromData(data: object): string {
  return extractMessageFromData(data);
}

export function st_getLogprobsNumber(): number {
  return getLogprobsNumber();
}

export function st_getTextGenServer(type?: string): string {
  return getTextGenServer(type);
}

export function st_replaceMacrosInList(str: string): string {
  return replaceMacrosInList(str);
}

export { Popup, name1, name2, chat_completion_sources, textgen_types, amount_gen, max_context };
