import { extensionName, st_echo } from './config';

const context = SillyTavern.getContext();

async function initUI() {
  if (!context.extensionSettings.translateViaLlm) {
    context.extensionSettings.translateViaLlm = {
      selectedProfile: '',
    };
  }

  const showTranslateButton = $(
    `<div title="Translate via LLM" class="mes_button mes_translate_via_llm_button fa-solid fa-globe interactable" tabindex="0"></div>`,
  );
  $('#message_template .mes_buttons .extraMesButtons').prepend(showTranslateButton);
  $(document).on('click', '.mes_translate_via_llm_button', async function () {
    const messageBlock = $(this).closest('.mes');
    const messageId = Number(messageBlock.attr('mesid'));
  });

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
    for (const profile of context.extensionSettings.connectionManager.profiles) {
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
}

function getChatCompletionBody(settingsElement: JQuery<HTMLElement>, profileId: string, prompt: string) {
  const profile = context.extensionSettings.connectionManager.profiles.find((p) => p.id === profileId);
  if (!profile) {
    st_echo('error', `Could not find profile with id ${profileId}`);
    return null;
  }

  const promptTemplate = settingsElement.find('.prompt').val() as string;
  const replacedPrompt = promptTemplate.replace(/{{prompt}}/g, prompt);
}

initUI();
