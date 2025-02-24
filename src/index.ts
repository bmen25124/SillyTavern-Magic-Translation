import {
  chat_completion_sources,
  chatCompletionSourceToModel,
  context,
  extensionName,
  name1,
  name2,
  st_echo,
  st_extractMessageFromData,
  st_getConnectApiMap,
  st_getPresetManager,
} from './config';

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
    context.extensionSettings.translateViaLlm = {
      selectedProfile: '',
      template: `Translate this to {{language}}:
\`\`\`
{{prompt}}
\`\`\``,
    };
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

  const showTranslateButton = $(
    `<div title="Translate via LLM" class="mes_button mes_translate_via_llm_button fa-solid fa-globe interactable" tabindex="0"></div>`,
  );
  $('#message_template .mes_buttons .extraMesButtons').prepend(showTranslateButton);
  $(document).on('click', '.mes_translate_via_llm_button', async function () {
    const messageBlock = $(this).closest('.mes');
    const messageId = Number(messageBlock.attr('mesid'));
    const body = getChatCompletionBody(
      context.extensionSettings.translateViaLlm.selectedProfile,
      messageBlock.find('.mes_text').text(),
    );
    if (!body) {
      return;
    }
    console.debug(body);

    const response = await sendOpenAIRequest(body);
    console.debug(response);
  });
}

function getChatCompletionBody(profileId: string, prompt: string) {
  const profile = context.extensionSettings.connectionManager!.profiles.find((p) => p.id === profileId);
  if (!profile) {
    st_echo('error', `Could not find profile with id ${profileId}`);
    return null;
  }
  if (!profile.api) {
    st_echo('error', 'Select a connection profile that has an API');
    return null;
  }
  if (!profile.preset) {
    st_echo('error', 'Select a connection profile that has a preset');
    return null;
  }

  const targetLanguageCode = context.extensionSettings.translate!.target_language;
  const targetLanguageText = $('#translation_target_language')
    .children('option[value="' + targetLanguageCode + '"]')
    .text();
  if (!targetLanguageText) {
    st_echo('error', `Could not find target language ${targetLanguageCode}`);
    return null;
  }

  const replacedPrompt = context.extensionSettings.translateViaLlm.template
    .replace(/{{prompt}}/g, prompt)
    .replace(/{{language}}/g, targetLanguageText);

  console.debug(replacedPrompt);

  const presetList = st_getPresetManager('openai').getPresetList();
  const preset = structuredClone(presetList.presets[presetList.preset_names[profile.preset]]);
  if (!preset) {
    st_echo('error', `Could not find preset ${profile.preset}`);
    return null;
  }

  const selectedApiMap = st_getConnectApiMap()[profile.api];
  if (!selectedApiMap) {
    st_echo('error', `Could not find API ${profile.api}`);
    return null;
  }

  return selectedApiMap.selected === 'openai' ? getOpenAIData(selectedApiMap, replacedPrompt, preset) : null;
}

function getOpenAIData(selectedApiMap: { selected: string; source?: string }, replacedPrompt: string, preset: any) {
  const chat_completion_source = selectedApiMap.source || chat_completion_sources.OPENAI;
  const isClaude = chat_completion_source == chat_completion_sources.CLAUDE;
  const isOpenRouter = chat_completion_source == chat_completion_sources.OPENROUTER;
  const isScale = chat_completion_source == chat_completion_sources.SCALE;
  const isGoogle = chat_completion_source == chat_completion_sources.MAKERSUITE;
  const isOAI = chat_completion_source == chat_completion_sources.OPENAI;
  const isMistral = chat_completion_source == chat_completion_sources.MISTRALAI;
  const isCustom = chat_completion_source == chat_completion_sources.CUSTOM;
  const isCohere = chat_completion_source == chat_completion_sources.COHERE;
  const isPerplexity = chat_completion_source == chat_completion_sources.PERPLEXITY;
  const isGroq = chat_completion_source == chat_completion_sources.GROQ;
  const is01AI = chat_completion_source == chat_completion_sources.ZEROONEAI;
  const isDeepSeek = chat_completion_source == chat_completion_sources.DEEPSEEK;

  let generate_data: any = {};
  generate_data = {
    messages: [
      {
        role: 'system',
        content: replacedPrompt,
      },
    ],
    model: chatCompletionSourceToModel(chat_completion_source),
    temperature: preset.temperature,
    frequency_penalty: preset.freq_pen,
    presence_penalty: preset.pres_pen,
    top_p: preset.top_p,
    max_tokens: preset.openai_max_tokens,
    stream: false, // Maybe optional?
    stop: [], // Don't care
    chat_completion_source: chat_completion_source,
    n: preset.n > 1 && isOAI ? preset.n : undefined,
    user_name: name1, // Don't care
    char_name: name2, // Don't care
    group_names: [], // Don't care
    include_reasoning: false, // Don't care
    reasoning_effort: 'medium', // Don't care
  };

  if (
    preset.reverse_proxy &&
    [
      chat_completion_sources.CLAUDE,
      chat_completion_sources.OPENAI,
      chat_completion_sources.MISTRALAI,
      chat_completion_sources.MAKERSUITE,
      chat_completion_sources.DEEPSEEK,
    ].includes(chat_completion_source)
  ) {
    // No need to validate
    generate_data['reverse_proxy'] = preset.reverse_proxy;
    generate_data['proxy_password'] = preset.proxy_password;
  }

  // Add logprobs request (currently OpenAI only, max 5 on their side)
  if (context.powerUserSettings.request_token_probabilities && (isOAI || isCustom || isDeepSeek)) {
    generate_data['logprobs'] = 5;
  }

  if (isClaude) {
    generate_data['top_k'] = Number(preset.top_k);
    generate_data['claude_use_sysprompt'] = preset.claude_use_sysprompt;
  }

  if (isOpenRouter) {
    generate_data['top_k'] = Number(preset.top_k);
    generate_data['min_p'] = Number(preset.min_p);
    generate_data['repetition_penalty'] = Number(preset.repetition_penalty);
    generate_data['top_a'] = Number(preset.top_a);
    generate_data['use_fallback'] = preset.openrouter_use_fallback;
    generate_data['provider'] = preset.openrouter_providers;
    generate_data['allow_fallbacks'] = preset.openrouter_allow_fallbacks;
    generate_data['middleout'] = preset.openrouter_middleout;
  }

  if (isScale) {
    generate_data['api_url_scale'] = preset.api_url_scale;
  }

  if (isGoogle) {
    generate_data['top_k'] = Number(preset.top_k);
    generate_data['use_makersuite_sysprompt'] = preset.use_makersuite_sysprompt;
  }

  if (isMistral) {
    generate_data['safe_prompt'] = false; // already defaults to false, but just incase they change that in the future.
  }

  if (isCustom) {
    generate_data['custom_url'] = preset.custom_url;
    generate_data['custom_include_body'] = preset.custom_include_body;
    generate_data['custom_exclude_body'] = preset.custom_exclude_body;
    generate_data['custom_include_headers'] = preset.custom_include_headers;
    generate_data['custom_prompt_post_processing'] = preset.custom_prompt_post_processing;
  }

  if (isCohere) {
    // Clamp to 0.01 -> 0.99
    generate_data['top_p'] = Math.min(Math.max(Number(preset.top_p), 0.01), 0.99);
    generate_data['top_k'] = Number(preset.top_k);
    // Clamp to 0 -> 1
    generate_data['frequency_penalty'] = Math.min(Math.max(Number(preset.freq_pen), 0), 1);
    generate_data['presence_penalty'] = Math.min(Math.max(Number(preset.pres_pen), 0), 1);
  }

  if (isPerplexity) {
    generate_data['top_k'] = Number(preset.top_k);
    // Normalize values. 1 == disabled. 0 == is usual disabled state in OpenAI.
    generate_data['frequency_penalty'] = Math.max(0, Number(preset.freq_pen)) + 1;
    generate_data['presence_penalty'] = Number(preset.pres_pen);

    // YEAH BRO JUST USE OPENAI CLIENT BRO
    delete generate_data['stop'];
  }

  // https://console.groq.com/docs/openai
  if (isGroq) {
    delete generate_data.logprobs;
    delete generate_data.logit_bias;
    delete generate_data.top_logprobs;
    delete generate_data.n;
  }

  // https://platform.01.ai/docs#request-body
  if (is01AI) {
    delete generate_data.logprobs;
    delete generate_data.logit_bias;
    delete generate_data.top_logprobs;
    delete generate_data.n;
    delete generate_data.frequency_penalty;
    delete generate_data.presence_penalty;
    delete generate_data.stop;
  }

  // https://api-docs.deepseek.com/api/create-chat-completion
  if (isDeepSeek) {
    generate_data.top_p = generate_data.top_p || Number.EPSILON;

    if (generate_data.model.endsWith('-reasoner')) {
      delete generate_data.top_p;
      delete generate_data.temperature;
      delete generate_data.frequency_penalty;
      delete generate_data.presence_penalty;
      delete generate_data.top_logprobs;
      delete generate_data.logprobs;
      delete generate_data.logit_bias;
      delete generate_data.tools;
      delete generate_data.tool_choice;
    }
  }

  if (isOAI && (preset.openai_model.startsWith('o1') || preset.openai_model.startsWith('o3'))) {
    generate_data.messages.forEach((msg: any) => {
      if (msg.role === 'system') {
        msg.role = 'user';
      }
    });
    generate_data.max_completion_tokens = generate_data.max_tokens;
    delete generate_data.max_tokens;
    delete generate_data.logprobs;
    delete generate_data.top_logprobs;
    delete generate_data.n;
    delete generate_data.temperature;
    delete generate_data.top_p;
    delete generate_data.frequency_penalty;
    delete generate_data.presence_penalty;
    delete generate_data.tools;
    delete generate_data.tool_choice;
    delete generate_data.stop;
    delete generate_data.logit_bias;
  }

  return generate_data;
}

async function sendOpenAIRequest(generate_data: any) {
  const generate_url = '/api/backends/chat-completions/generate';
  const response = await fetch(generate_url, {
    method: 'POST',
    body: JSON.stringify(generate_data),
    headers: context.getRequestHeaders(),
    signal: new AbortController().signal, // No cancellation for now
  });

  if (!response.ok) {
    throw new Error(`Got response status ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    const message = data.error.message || response.statusText || `Unknown error`;
    st_echo('error', message);
    throw new Error(message);
  }

  return st_extractMessageFromData(data);
}

initUI();
