import { context, extensionName, st_echo, st_updateMessageBlock } from './config';
import { getGeneratePayload, sendGenerateRequest } from './generate';

const DEFAULT_PROMPT = `Translate this text to {{language}}. You must format your response as a code block using triple backticks. Only include the translated text inside the code block, without any additional text:

\`\`\`
{{prompt}}
\`\`\`

Important: Your response must follow this exact format with the translation enclosed in code blocks (\`\`\`).`;

async function initUI() {
  if (!context.extensionSettings.connectionManager) {
    st_echo('error', 'Connection Manager is required to use Translate via LLM');
    return;
  }
  if (!context.extensionSettings.translate) {
    st_echo('error', 'Translate is required to use Translate via LLM');
    return;
  }

  if (!context.extensionSettings.translateViaLlm) {
    context.extensionSettings.translateViaLlm = {};
  }

  if (context.extensionSettings.translateViaLlm.selectedProfile === undefined) {
    context.extensionSettings.translateViaLlm.selectedProfile = '';
  }
  if (context.extensionSettings.translateViaLlm.template === undefined) {
    context.extensionSettings.translateViaLlm.template = DEFAULT_PROMPT;
  }
  if (context.extensionSettings.translateViaLlm.filterCodeBlock === undefined) {
    context.extensionSettings.translateViaLlm.filterCodeBlock = true;
  }

  const settingsHtml = await context.renderExtensionTemplateAsync(`third-party/${extensionName}`, 'templates/settings');
  $('#extensions_settings').append(settingsHtml);

  const settingsElement = $('.translate-via-llm-settings');
  const selectElement = settingsElement.find('.profile');

  let refreshing = false;
  settingsElement.find('.inline-drawer-toggle').on('click', function () {
    refreshing = true;
    // Remove all children except the empty option
    const emptyOption = selectElement.find('option[value=""]');
    selectElement.empty().append(emptyOption);
    for (const profile of context.extensionSettings.connectionManager!.profiles) {
      const option = $('<option></option>');
      option.attr('value', profile.id);
      option.text(profile.name || profile.id);
      option.prop('selected', profile.id === context.extensionSettings.translateViaLlm.selectedProfile);
      selectElement.append(option);
    }
    refreshing = false;
  });

  selectElement.on('change', function () {
    if (refreshing) {
      return;
    }
    const selected = selectElement.val() as string;
    if (selected !== context.extensionSettings.translateViaLlm.selectedProfile) {
      context.extensionSettings.translateViaLlm.selectedProfile = selected;
      context.saveSettingsDebounced();
    }
  });

  const promptElement = settingsElement.find('.prompt');
  promptElement.val(context.extensionSettings.translateViaLlm.template);
  promptElement.on('change', function () {
    const template = promptElement.val() as string;
    if (template !== context.extensionSettings.translateViaLlm.template) {
      context.extensionSettings.translateViaLlm.template = template;
      context.saveSettingsDebounced();
    }
  });

  const filterCodeBlockElement = settingsElement.find('.filter_code_block');
  filterCodeBlockElement.prop('checked', context.extensionSettings.translateViaLlm.filterCodeBlock);
  filterCodeBlockElement.on('change', function () {
    const checked = filterCodeBlockElement.prop('checked');
    context.extensionSettings.translateViaLlm.filterCodeBlock = checked;
    context.saveSettingsDebounced();
  });

  settingsElement.find('.restore_default').on('click', function () {
    promptElement.val(DEFAULT_PROMPT);
    promptElement.trigger('change');
  });

  const showTranslateButton = $(
    `<div title="Translate via LLM" class="mes_button mes_translate_via_llm_button fa-solid fa-globe interactable" tabindex="0"></div>`,
  );
  $('#message_template .mes_buttons .extraMesButtons').prepend(showTranslateButton);

  let generating = false;
  $(document).on('click', '.mes_translate_via_llm_button', async function () {
    if (generating) {
      st_echo('error', 'Translation is already in progress');
      return;
    }
    generating = true;
    try {
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
      if (!context.extensionSettings.translateViaLlm.selectedProfile) {
        st_echo('error', 'Select a connection profile');
        return;
      }

      const result = getGeneratePayload(context.extensionSettings.translateViaLlm.selectedProfile, message.mes);
      if (!result) {
        return;
      }
      console.debug(result);

      const response = await sendGenerateRequest(result.body, result.url, result.type);
      console.debug(response);

      if (typeof message.extra !== 'object') {
        message.extra = {};
      }

      let displayText = response;
      if (context.extensionSettings.translateViaLlm.filterCodeBlock) {
        const codeBlockMatch = response.match(/^(?:[^`]*?)\n?```[\s\S]*?\n([\s\S]*?)```(?![^`]*```)/);
        if (codeBlockMatch) {
          displayText = codeBlockMatch[1].trim();
        }
      }

      message.extra.display_text = displayText;
      st_updateMessageBlock(messageId, message);
    } catch (error) {
      console.error(error);
    } finally {
      generating = false;
    }
  });
}

initUI();
