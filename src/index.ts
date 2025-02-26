import { context, extensionName, st_echo, st_updateMessageBlock } from './config';
import { getGeneratePayload, sendGenerateRequest } from './generate';
import { AutoModeOptions, defaultSettings, EventNames, languageCodes } from './types/types';

const incomingTypes = [AutoModeOptions.RESPONSES, AutoModeOptions.BOTH];
const outgoingTypes = [AutoModeOptions.INPUT, AutoModeOptions.BOTH];

const extensionSettingsButton = $('#extensions-settings-button .drawer-toggle');
const extensionSettingsVisible = () => {
  return $('#rm_extensions_block').is(':visible');
};
let extensionBlockButton: JQuery<HTMLElement>;
const extensionBlockVisible = () => {
  return $('.magic-translation-settings .inline-drawer-content').is(':visible');
};

const sysSettingsButton = $('#sys-settings-button .drawer-toggle');

/**
 * Message IDs that are currently being generated
 */
let generating: number[] = [];
async function initUI() {
  if (!context.extensionSettings.connectionManager) {
    st_echo('error', 'Connection Manager is required to use Magic Translation');
    return;
  }

  initDefaultValues();
  await initSettings();

  const showTranslateButton = $(
    `<div title="Magic Translate" class="mes_button mes_magic_translation_button fa-solid fa-globe interactable" tabindex="0"></div>`,
  );
  $('#message_template .mes_buttons .extraMesButtons').prepend(showTranslateButton);

  $(document).on('click', '.mes_magic_translation_button', function () {
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
    generateMessage(messageId, 'incomingMessage');
  });

  context.eventSource.on(EventNames.MESSAGE_UPDATED, (messageId: number) => {
    if (incomingTypes.includes(context.extensionSettings.magicTranslation.autoMode!)) {
      generateMessage(messageId, 'incomingMessage');
    }
  });
  context.eventSource.on(EventNames.IMPERSONATE_READY, (messageId: number) => {
    if (outgoingTypes.includes(context.extensionSettings.magicTranslation.autoMode!)) {
      generateMessage(messageId, 'impersonate');
    }
  });

  // @ts-ignore
  context.eventSource.makeFirst(EventNames.CHARACTER_MESSAGE_RENDERED, (messageId: number) => {
    if (incomingTypes.includes(context.extensionSettings.magicTranslation.autoMode!)) {
      generateMessage(messageId, 'incomingMessage');
    }
  });
  // @ts-ignore
  context.eventSource.makeFirst(EventNames.USER_MESSAGE_RENDERED, (messageId: number) => {
    if (outgoingTypes.includes(context.extensionSettings.magicTranslation.autoMode!)) {
      generateMessage(messageId, 'userInput');
    }
  });
}

function initDefaultValues() {
  let anyChange = false;
  if (!context.extensionSettings.magicTranslation) {
    context.extensionSettings.magicTranslation = {};
    anyChange = true;
  }

  if (context.extensionSettings.magicTranslation.profile === undefined) {
    context.extensionSettings.magicTranslation.profile = defaultSettings.profile;
    anyChange = true;
  }
  if (context.extensionSettings.magicTranslation.template === undefined) {
    context.extensionSettings.magicTranslation.template = defaultSettings.template;
    anyChange = true;
  }
  if (context.extensionSettings.magicTranslation.filterCodeBlock === undefined) {
    context.extensionSettings.magicTranslation.filterCodeBlock = defaultSettings.filterCodeBlock;
    anyChange = true;
  }
  if (context.extensionSettings.magicTranslation.targetLanguage === undefined) {
    context.extensionSettings.magicTranslation.targetLanguage =
      context.extensionSettings.translate?.target_language || defaultSettings.targetLanguage;
    anyChange = true;
  }
  if (context.extensionSettings.magicTranslation.internalLanguage === undefined) {
    context.extensionSettings.magicTranslation.internalLanguage = defaultSettings.internalLanguage;
    anyChange = true;
  }
  if (context.extensionSettings.magicTranslation.autoMode === undefined) {
    context.extensionSettings.magicTranslation.autoMode =
      context.extensionSettings.translate?.auto_mode || defaultSettings.autoMode;
    anyChange = true;
  }
  if (context.extensionSettings.magicTranslation.autoOpenSettings === undefined) {
    context.extensionSettings.magicTranslation.autoOpenSettings = defaultSettings.autoOpenSettings;
    anyChange = true;
  }
  if (context.extensionSettings.magicTranslation.showMissingWarning === undefined) {
    context.extensionSettings.magicTranslation.showMissingWarning = defaultSettings.showMissingWarning;
    anyChange = true;
  }

  if (anyChange) {
    context.saveSettingsDebounced();
  }
}

async function initSettings() {
  const extendedLanguageCodes = Object.entries(languageCodes).reduce(
    (acc, [name, code]) => {
      // @ts-ignore
      acc[code] = { name: name, selected: code === context.extensionSettings.magicTranslation.targetLanguage };
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

  const selectElement = settingsElement.find('.profile');

  let refreshing = false;
  extensionBlockButton = settingsElement.find('.inline-drawer-toggle');
  extensionBlockButton.on('click', function () {
    refreshing = true;
    // Remove all children except the empty option
    const emptyOption = selectElement.find('option[value=""]');
    selectElement.empty().append(emptyOption);

    const currentProfileId = context.extensionSettings.magicTranslation.profile;
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
      } else if (context.extensionSettings.magicTranslation.showMissingWarning) {
        const missing = [];
        if (!profile.api) missing.push('API');
        if (!profile.preset) missing.push('preset');
        st_echo(
          'warning',
          `Profile "${profile.name || profile.id}" is not available for translation: missing ${missing.join(', ')}`,
        );
      }
    }

    if (currentProfileId && !foundCurrentProfile) {
      st_echo(
        'warning',
        `Previously selected profile "${currentProfileId}" no longer exists. Please select a new profile.`,
      );
      context.extensionSettings.magicTranslation.profile = '';
      context.saveSettingsDebounced();
    }

    refreshing = false;
  });

  selectElement.on('change', function () {
    if (refreshing) {
      return;
    }
    const selected = selectElement.val() as string;
    if (selected !== context.extensionSettings.magicTranslation.profile) {
      context.extensionSettings.magicTranslation.profile = selected;
      context.saveSettingsDebounced();
    }
  });

  const redirectSysSettings = settingsElement.find('.redirect_sys_settings');
  redirectSysSettings.on('click', function () {
    sysSettingsButton.trigger('click');
  });

  const promptElement = settingsElement.find('.prompt');
  promptElement.val(context.extensionSettings.magicTranslation.template!);
  promptElement.on('change', function () {
    const template = promptElement.val() as string;
    if (template !== context.extensionSettings.magicTranslation.template) {
      context.extensionSettings.magicTranslation.template = template;
      context.saveSettingsDebounced();
    }
  });

  const filterCodeBlockElement = settingsElement.find('.filter_code_block');
  filterCodeBlockElement.prop('checked', context.extensionSettings.magicTranslation.filterCodeBlock);
  filterCodeBlockElement.on('change', function () {
    const checked = filterCodeBlockElement.prop('checked');
    context.extensionSettings.magicTranslation.filterCodeBlock = checked;
    context.saveSettingsDebounced();
  });

  settingsElement.find('.restore_default').on('click', function () {
    promptElement.val(defaultSettings.template);
    promptElement.trigger('change');
  });

  const targetLanguageElement = settingsElement.find('.target_language');
  targetLanguageElement.val(context.extensionSettings.magicTranslation.targetLanguage!);
  targetLanguageElement.on('change', function () {
    const targetLanguage = targetLanguageElement.val() as string;
    if (targetLanguage !== context.extensionSettings.magicTranslation.targetLanguage) {
      context.extensionSettings.magicTranslation.targetLanguage = targetLanguage;
      context.saveSettingsDebounced();
    }
  });

  const autoModeElement = settingsElement.find('.auto_mode');
  autoModeElement.val(context.extensionSettings.magicTranslation.autoMode!);
  autoModeElement.on('change', function () {
    const autoMode = autoModeElement.val() as string;
    if (autoMode !== context.extensionSettings.magicTranslation.autoMode) {
      context.extensionSettings.magicTranslation.autoMode = autoMode as AutoModeOptions;
      context.saveSettingsDebounced();
    }
  });

  const autoOpenSettingsElement = settingsElement.find('.auto_open_settings');
  autoOpenSettingsElement.prop('checked', context.extensionSettings.magicTranslation.autoOpenSettings);
  autoOpenSettingsElement.on('change', function () {
    const checked = autoOpenSettingsElement.prop('checked');
    context.extensionSettings.magicTranslation.autoOpenSettings = checked;
    context.saveSettingsDebounced();
  });

  const showMissingWarningElement = settingsElement.find('.show_missing_warning');
  showMissingWarningElement.prop('checked', context.extensionSettings.magicTranslation.showMissingWarning);
  showMissingWarningElement.on('change', function () {
    const checked = showMissingWarningElement.prop('checked');
    context.extensionSettings.magicTranslation.showMissingWarning = checked;
    context.saveSettingsDebounced();
  });
}

/**
 * @param messageId If type is 'impersonate', messageId is the message impersonate
 * @param type userInput: User sended message, incomingMessage: Message from LLM, impersonate: Message impersonate
 */
async function generateMessage(messageId: number, type: 'userInput' | 'incomingMessage' | 'impersonate') {
  const profileId = context.extensionSettings.magicTranslation.profile;
  if (!profileId) {
    let warningMessage = 'Select a connection profile';
    if (context.extensionSettings.magicTranslation.autoOpenSettings) {
      if (!extensionSettingsVisible()) {
        extensionSettingsButton.trigger('click');
      }
      if (!extensionBlockVisible()) {
        extensionBlockButton.trigger('click');
      }
    }

    // Improve warning message
    if (type === 'userInput' && outgoingTypes.includes(context.extensionSettings.magicTranslation.autoMode!)) {
      warningMessage += '. Or disable auto mode.';
    } else if (type === 'impersonate' && outgoingTypes.includes(context.extensionSettings.magicTranslation.autoMode!)) {
      warningMessage += '. Or disable auto mode.';
    } else if (
      type === 'incomingMessage' &&
      incomingTypes.includes(context.extensionSettings.magicTranslation.autoMode!)
    ) {
      warningMessage += '. Or disable auto mode.';
    }

    st_echo('warning', warningMessage);
    return;
  }
  if (!context.extensionSettings.magicTranslation.template) {
    st_echo('error', 'Missing template, set a template in the Magic Translation settings');
    return null;
  }

  const message = type !== 'impersonate' ? context.chat[messageId] : undefined;
  if (!message) {
    st_echo('error', `Could not find message with id ${messageId}`);
    return;
  }
  if (generating.includes(messageId) && message) {
    st_echo('warning', 'Translation is already in progress');
    return;
  }

  const languageCode =
    type === 'userInput'
      ? context.extensionSettings.magicTranslation.internalLanguage
      : context.extensionSettings.magicTranslation.targetLanguage;
  const languageText = Object.entries(languageCodes).find(([, code]) => code === languageCode)?.[0];
  if (!languageText) {
    st_echo('error', `Make sure language ${languageCode} is supported`);
    return null;
  }

  const prompt = context.extensionSettings.magicTranslation.template
    .replace(/{{prompt}}/g, message?.mes ?? (messageId as unknown as string))
    .replace(/{{language}}/g, languageText);

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
    if (context.extensionSettings.magicTranslation.filterCodeBlock) {
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

initUI();
