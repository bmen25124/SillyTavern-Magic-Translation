import { EventEmitter } from 'stream';
import { AutoModeOptions } from './types';

declare global {
  interface ConnectionProfile {
    id: string;
    mode: string;
    name?: string;
    api?: string;
    preset?: string;
    model?: string;
    proxy?: string;
    instruct?: string;
    context?: string;
    instruct_state?: string;
    tokenizer?: string;
    stop_strings?: string;
    exclude?: string[];
  }

  interface SillyTavernContext {
    createCharacterData: { extensions: Record<string, any> };
    convertCharacterBook: (characterBook: any) => {
      entries: {};
      originalData: any;
    };
    updateWorldInfoList: () => Promise<void>;
    loadWorldInfo: (name: string) => Promise<any | null>;
    saveWorldInfo: (name: string, data: any, immediately?: boolean) => Promise<void>;
    humanizedDateTime: () => string;
    getCharacters: () => Promise<void>;
    uuidv4: () => string;
    getRequestHeaders: () => {
      'Content-Type': string;
      'X-CSRF-Token': any;
    };
    renderExtensionTemplateAsync: (
      extensionName: string,
      templateId: string,
      templateData?: object,
      sanitize?: boolean,
      localize?: boolean,
    ) => Promise<string>;
    extensionSettings: {
      connectionManager?: {
        profiles: ConnectionProfile[];
      };
      translate?: {
        target_language: string;
        auto_mode: AutoModeOptions;
      };
      translateViaLlm: {
        profile?: string;
        template?: string;
        filterCodeBlock?: boolean;
        targetLanguage?: string;
        internalLanguage?: string;
        autoMode?: AutoModeOptions;
        autoOpenSettings?: boolean;
      };
    };
    saveSettingsDebounced: () => void;
    chatCompletionSettings: any;
    powerUserSettings: {
      request_token_probabilities: boolean;
    };
    chat: Record<
      number,
      {
        mes: string;
        extra?: {
          display_text?: string;
        };
      }
    >;
    eventSource: EventEmitter;
  }

  const SillyTavern: {
    getContext(): SillyTavernContext;
  };
}

export {};
