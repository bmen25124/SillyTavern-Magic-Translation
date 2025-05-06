import { ExtensionSettingsManager, buildPresetSelect } from 'sillytavern-utils-lib';
import { context, extensionName, st_echo, st_updateMessageBlock } from './config.js';
import { getGeneratePayload, sendGenerateRequest } from './generate.js';
import { EventNames } from 'sillytavern-utils-lib/types';
import { AutoModeOptions } from 'sillytavern-utils-lib/types/translate';
import { languageCodes } from './types/types.js';

interface PromptPreset {
  content: string;
  filterCodeBlock: boolean;
}

interface ExtensionSettings {
  version: string;
  formatVersion: string;
  profile: string;
  targetLanguage: string;
  internalLanguage: string;
  autoMode: AutoModeOptions;
  promptPreset: string;
  promptPresets: Record<string, PromptPreset>;
}

const VERSION = '0.1.1';
const FORMAT_VERSION = 'F_1.0';

const DEFAULT_PROMPT = `Translate this text to {{language}}. Respect markdown. You must format your response as a code block using triple backticks. Only include the translated text inside the code block, without any additional text:

\`\`\`
{{prompt}}
\`\`\`

Important: Your response must follow this exact format with the translation enclosed in code blocks (\`\`\`).`;

const defaultSettings: ExtensionSettings = {
  version: VERSION,
  formatVersion: FORMAT_VERSION,
  profile: '',
  targetLanguage: 'en',
  internalLanguage: 'en',
  autoMode: AutoModeOptions.NONE,
  promptPreset: 'default',
  promptPresets: {
    default: {
      content: DEFAULT_PROMPT,
      filterCodeBlock: true,
    },
  },
};

// Keys for extension settings
const EXTENSION_KEY = 'magicTranslation';

// Message IDs that are currently being generated
let generating: number[] = [];

const settingsManager = new ExtensionSettingsManager<ExtensionSettings>(EXTENSION_KEY, defaultSettings);

const incomingTypes = [AutoModeOptions.RESPONSES, AutoModeOptions.BOTH];
const outgoingTypes = [AutoModeOptions.INPUT, AutoModeOptions.BOTH];

async function initUI() {
  if (!context.extensionSettings.connectionManager) {
    st_echo('error', 'Connection Manager is required to use Magic Translation');
    return;
  }

  await initSettings();

  const showTranslateButton = $(
    `<div title="Magic Translate" class="mes_button mes_magic_translation_button fa-solid fa-globe interactable" tabindex="0"></div>`,
  );
  $('#message_template .mes_buttons .extraMesButtons').prepend(showTranslateButton);

  $(document).on('click', '.mes_magic_translation_button', async function () {
    const messageBlock = $(this).closest('.mes');
    const messageId = Number(messageBlock.attr('mesid'));
    const message = context.chat[messageId];
    if (!message) {
      st_echo('error', `Could not find message with id ${messageId}`);
      return;
    }
    if (message?.extra?.display_text) {
      delete message.extra.display_text;
      st_updateMessageBlock(messageId, message);
      return;
    }
    await generateMessage(messageId, 'incomingMessage');
    const eventData = {
      messageId,
      type: 'incomingMessage',
      auto: false,
    };
    context.eventSource.emit('magic_translation_done', eventData);
    context.eventSource.emit('magic_translation_character_message', eventData);
  });

  const settings = settingsManager.getSettings();
  context.eventSource.on(EventNames.MESSAGE_UPDATED, async (messageId: number) => {
    if (incomingTypes.includes(settings.autoMode)) {
      await generateMessage(messageId, 'incomingMessage');
      context.eventSource.emit('magic_translation_done', {
        messageId,
        type: 'incomingMessage',
        auto: true,
      });
    }
  });
  context.eventSource.on(EventNames.IMPERSONATE_READY, async (messageId: number) => {
    if (outgoingTypes.includes(settings.autoMode)) {
      await generateMessage(messageId, 'impersonate');
      const eventData = {
        messageId,
        type: 'impersonate',
        auto: true,
      };
      context.eventSource.emit('magic_translation_done', eventData);
      context.eventSource.emit('magic_translation_impersonate', eventData);
    }
  });

  // @ts-ignore
  context.eventSource.makeFirst(EventNames.CHARACTER_MESSAGE_RENDERED, async (messageId: number) => {
    if (incomingTypes.includes(settings.autoMode)) {
      await generateMessage(messageId, 'incomingMessage');
      const eventData = {
        messageId,
        type: 'incomingMessage',
        auto: true,
      };
      context.eventSource.emit('magic_translation_done', eventData);
      context.eventSource.emit('magic_translation_character_message', eventData);
    }
  });
  // @ts-ignore
  context.eventSource.makeFirst(EventNames.USER_MESSAGE_RENDERED, async (messageId: number) => {
    if (outgoingTypes.includes(settings.autoMode)) {
      await generateMessage(messageId, 'userInput');
      const eventData = {
        messageId,
        type: 'userInput',
        auto: true,
      };
      context.eventSource.emit('magic_translation_done', eventData);
      context.eventSource.emit('magic_translation_user_message', eventData);
    }
  });
}

async function initSettings() {
  const settings = settingsManager.getSettings();

  const extendedLanguageCodes = Object.entries(languageCodes).reduce(
    (acc, [name, code]) => {
      // @ts-ignore
      acc[code] = { name: name, selected: code === settings.targetLanguage };
      return acc;
    },
    {} as Record<string, { name: string; selected: boolean }>,
  );

  const settingsHtml = await context.renderExtensionTemplateAsync(
    `third-party/${extensionName}`,
    'templates/settings',
    { languageCodes: extendedLanguageCodes },
  );
  $('#extensions_settings').append(settingsHtml);

  const settingsElement = $('.magic-translation-settings');
  const promptElement = settingsElement.find('.prompt');
  const filterCodeBlockElement = settingsElement.find('.filter_code_block');

  // Use buildPresetSelect for preset management
  buildPresetSelect('.magic-translation-settings select.prompt_preset', {
    label: 'prompt',
    initialValue: settings.promptPreset,
    initialList: Object.keys(settings.promptPresets),
    readOnlyValues: ['default'],
    onSelectChange: async (_previousValue, newValue) => {
      const newPresetValue = newValue ?? 'default';
      settings.promptPreset = newPresetValue;
      const preset = settings.promptPresets[newPresetValue];

      promptElement.val(preset.content);
      filterCodeBlockElement.prop('checked', preset.filterCodeBlock);

      settingsManager.saveSettings();
    },
    create: {
      onAfterCreate: (value) => {
        const currentPreset = settings.promptPresets[settings.promptPreset];
        settings.promptPresets[value] = {
          content: currentPreset.content,
          filterCodeBlock: currentPreset.filterCodeBlock,
        };
      },
    },
    rename: {
      onAfterRename: (previousValue, newValue) => {
        settings.promptPresets[newValue] = settings.promptPresets[previousValue];
        delete settings.promptPresets[previousValue];
      },
    },
    delete: {
      onAfterDelete: (value) => {
        delete settings.promptPresets[value];
      },
    },
  });

  // Profile selection
  const selectElement = settingsElement.find('.profile');

  let refreshing = false;
  const extensionBlockButton = settingsElement.find('.inline-drawer-toggle');
  extensionBlockButton.on('click', function () {
    refreshing = true;
    // Remove all children except the empty option
    const emptyOption = selectElement.find('option[value=""]');
    selectElement.empty().append(emptyOption);

    const currentProfileId = settings.profile;
    let foundCurrentProfile = false;

    for (const profile of context.extensionSettings.connectionManager!.profiles) {
      // Only add profiles that have all required properties
      if (profile.api && profile.preset) {
        const option = $('<option></option>');
        option.attr('value', profile.id);
        option.text(profile.name || profile.id);
        option.prop('selected', profile.id === currentProfileId);
        selectElement.append(option);
        if (profile.id === currentProfileId) {
          foundCurrentProfile = true;
        }
      }
    }

    if (currentProfileId && !foundCurrentProfile) {
      st_echo(
        'warning',
        `Previously selected profile "${currentProfileId}" no longer exists. Please select a new profile.`,
      );
      settings.profile = '';
      settingsManager.saveSettings();
    }

    refreshing = false;
  });

  selectElement.on('change', function () {
    if (refreshing) {
      return;
    }
    const selected = selectElement.val() as string;
    if (selected !== settings.profile) {
      settings.profile = selected;
      settingsManager.saveSettings();
    }
  });

  const sysSettingsButton = $('#sys-settings-button .drawer-toggle');
  const redirectSysSettings = settingsElement.find('.redirect_sys_settings');
  redirectSysSettings.on('click', function () {
    sysSettingsButton.trigger('click');
  });

  promptElement.val(settings.promptPresets[settings.promptPreset].content);
  promptElement.on('change', function () {
    const template = promptElement.val() as string;
    settings.promptPresets[settings.promptPreset].content = template;
    settingsManager.saveSettings();
  });

  settingsElement.find('.restore_default').on('click', async function () {
    const confirm = await context.Popup.show.confirm('Restore default prompt?', 'Restore Default');
    if (!confirm) return;

    promptElement.val(DEFAULT_PROMPT);
    settings.promptPresets[settings.promptPreset].content = DEFAULT_PROMPT;
    settingsManager.saveSettings();
  });

  filterCodeBlockElement.prop('checked', settings.promptPresets[settings.promptPreset].filterCodeBlock);
  filterCodeBlockElement.on('change', function () {
    const checked = filterCodeBlockElement.prop('checked');
    settings.promptPresets[settings.promptPreset].filterCodeBlock = checked;
    settingsManager.saveSettings();
  });

  const targetLanguageElement = settingsElement.find('.target_language');
  targetLanguageElement.val(settings.targetLanguage);
  targetLanguageElement.on('change', function () {
    const targetLanguage = targetLanguageElement.val() as string;
    settings.targetLanguage = targetLanguage;
    settingsManager.saveSettings();
  });

  const autoModeElement = settingsElement.find('.auto_mode');
  autoModeElement.val(settings.autoMode);
  autoModeElement.on('change', function () {
    const autoMode = autoModeElement.val() as string;
    settings.autoMode = autoMode as AutoModeOptions;
    settingsManager.saveSettings();
  });
}

/**
 * @param messageId If type is 'impersonate', messageId is the message impersonate
 * @param type userInput: User sended message, incomingMessage: Message from LLM, impersonate: Message impersonate
 */
async function generateMessage(messageId: number, type: 'userInput' | 'incomingMessage' | 'impersonate') {
  const settings = settingsManager.getSettings();
  const profileId = settings.profile;
  if (!profileId) {
    let warningMessage = 'Select a connection profile';

    // Improve warning message
    if (type === 'userInput' && outgoingTypes.includes(settings.autoMode)) {
      warningMessage += '. Or disable auto mode.';
    } else if (type === 'impersonate' && outgoingTypes.includes(settings.autoMode)) {
      warningMessage += '. Or disable auto mode.';
    } else if (type === 'incomingMessage' && incomingTypes.includes(settings.autoMode)) {
      warningMessage += '. Or disable auto mode.';
    }

    st_echo('warning', warningMessage);
    return;
  }

  const selectedPreset = settings.promptPresets[settings.promptPreset];
  if (!selectedPreset || !selectedPreset.content) {
    st_echo('error', 'Missing template, set a template in the Magic Translation settings');
    return null;
  }

  const message = type !== 'impersonate' ? context.chat[messageId] : undefined;
  if (!message && type !== 'impersonate') {
    st_echo('error', `Could not find message with id ${messageId}`);
    return;
  }
  if (generating.includes(messageId) && message) {
    st_echo('warning', 'Translation is already in progress');
    return;
  }

  const languageCode = type === 'userInput' ? settings.internalLanguage : settings.targetLanguage;
  const languageText = Object.entries(languageCodes).find(([, code]) => code === languageCode)?.[0];
  if (!languageText) {
    st_echo('error', `Make sure language ${languageCode} is supported`);
    return null;
  }

  const prompt = context.substituteParams(
    selectedPreset.content,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    {
      prompt: message?.mes ?? (messageId as unknown as string),
      language: languageText,
    },
  );

  if (message) {
    generating.push(messageId);
  }
  try {
    const result = getGeneratePayload(profileId, prompt);
    if (!result) {
      return;
    }

    const response = await sendGenerateRequest(result.body, result.url, result.type);

    let displayText = response;
    if (selectedPreset.filterCodeBlock) {
      const codeBlockMatch = response.match(/^(?:[^`]*?)\n?```[\s\S]*?\n([\s\S]*?)```(?![^`]*```)/);
      if (codeBlockMatch) {
        displayText = codeBlockMatch[1].trim();
      }
    }

    if (message) {
      if (type === 'userInput') {
        message.mes = displayText;
      } else {
        if (typeof message.extra !== 'object') {
          message.extra = {};
        }
        message.extra.display_text = displayText;
      }
      st_updateMessageBlock(messageId, message);
      await context.saveChat();
    } else {
      $('#send_textarea').val(displayText);
    }
  } catch (error) {
    console.error(error);
    st_echo('error', `Translation failed: ${error}`);
  } finally {
    if (message) {
      generating = generating.filter((id) => id !== messageId);
    }
  }
}

function main() {
  initUI();
}

settingsManager
  .initializeSettings()
  .then((result) => {
    const settings = settingsManager.getSettings();
    // Handle migration from old format
    if (result.oldSettings && !result.oldSettings.promptPresets) {
      const oldTemplate = result.oldSettings.template;
      if (oldTemplate && oldTemplate !== DEFAULT_PROMPT) {
        settings.promptPresets.custom = {
          content: oldTemplate,
          filterCodeBlock: result.oldSettings.filterCodeBlock ?? true,
        };
        settings.promptPreset = 'custom';
        settingsManager.saveSettings();
      }
    }

    main();
  })
  .catch((error) => {
    st_echo('error', error);
    context.Popup.show
      .confirm('Data migration failed. Do you want to reset the roadway data?', 'Roadway')
      .then((result: any) => {
        if (result) {
          settingsManager.resetSettings();
          main();
        }
      });
  });
