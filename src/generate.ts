import {
  amount_gen,
  chat_completion_sources,
  context,
  max_context,
  name1,
  name2,
  st_echo,
  st_getLogprobsNumber,
  st_replaceMacrosInList,
  textgen_types,
} from './config';

const MAX_TOKENS = 4096;

export function getGeneratePayload(
  profileId: string,
  prompt: string,
): null | { body: any; url: string; type: 'openai' | 'textgenerationwebui' } {
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

  const selectedApiMap = context.CONNECT_API_MAP[profile.api];
  if (!selectedApiMap) {
    st_echo('error', `Could not find API ${profile.api}`);
    return null;
  }
  if (!(selectedApiMap.selected === 'openai' || selectedApiMap.selected === 'textgenerationwebui')) {
    st_echo('error', `API ${profile.api} is not supported`);
    return null;
  }

  const presetList = context.getPresetManager(selectedApiMap.selected).getPresetList();
  const preset = structuredClone(
    selectedApiMap.selected === 'openai'
      ? // @ts-ignore
        presetList.presets[presetList.preset_names[profile.preset]]
      : // @ts-ignore
        presetList.presets[presetList.preset_names.indexOf(profile.preset)],
  );
  if (!preset) {
    st_echo('error', `Could not find preset ${profile.preset}`);
    return null;
  }

  if (selectedApiMap.selected === 'openai') {
    return {
      body: getOpenAIData(selectedApiMap, prompt, preset),
      url: '/api/backends/chat-completions/generate',
      type: selectedApiMap.selected,
    };
  } else {
    return {
      body: getTextGenData(selectedApiMap.type, prompt, preset, profile),
      url: '/api/backends/text-completions/generate',
      type: selectedApiMap.selected,
    };
  }
}

export function getOpenAIData(
  selectedApiMap: { selected: string; source?: string },
  replacedPrompt: string,
  preset: any,
) {
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
    model: context.getChatCompletionModel(chat_completion_source),
    temperature: preset.temperature,
    frequency_penalty: preset.freq_pen,
    presence_penalty: preset.pres_pen,
    top_p: preset.top_p,
    max_tokens: Math.max(MAX_TOKENS, preset.openai_max_tokens),
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

export function getTextGenData(
  type: string | undefined,
  replacedPrompt: string,
  preset: any,
  profile: ConnectionProfile,
) {
  if (!type) {
    st_echo('error', 'Select a connection profile that has a type');
    return null;
  }

  const canMultiSwipe = true;
  const dynatemp = document.getElementById('dynatemp_block_ooba')?.dataset?.tgType?.includes(type);
  const maxTokens = Math.max(MAX_TOKENS, preset.genamt ?? amount_gen);

  let params: any;
  params = {
    stream: false,
    prompt: replacedPrompt,
    model: profile.model,
    max_new_tokens: maxTokens,
    max_tokens: maxTokens,
    logprobs: context.powerUserSettings.request_token_probabilities ? st_getLogprobsNumber(type) : undefined,
    temperature: dynatemp ? (preset.min_temp + preset.max_temp) / 2 : preset.temp,
    top_p: preset.top_p,
    typical_p: preset.typical_p,
    typical: preset.typical_p,
    sampler_seed: preset.seed >= 0 ? preset.seed : undefined,
    min_p: preset.min_p,
    repetition_penalty: preset.rep_pen,
    frequency_penalty: preset.freq_pen,
    presence_penalty: preset.presence_pen,
    top_k: preset.top_k,
    skew: preset.skew,
    min_length: type === textgen_types.OOBA ? preset.min_length : undefined,
    minimum_message_content_tokens: type === textgen_types.DREAMGEN ? preset.min_length : undefined,
    min_tokens: preset.min_length,
    num_beams: type === textgen_types.OOBA ? preset.num_beams : undefined,
    length_penalty: type === textgen_types.OOBA ? preset.length_penalty : undefined,
    early_stopping: type === textgen_types.OOBA ? preset.early_stopping : undefined,
    add_bos_token: preset.add_bos_token,
    dynamic_temperature: dynatemp ? true : undefined,
    dynatemp_low: dynatemp ? preset.min_temp : undefined,
    dynatemp_high: dynatemp ? preset.max_temp : undefined,
    dynatemp_range: dynatemp ? (preset.max_temp - preset.min_temp) / 2 : undefined,
    dynatemp_exponent: dynatemp ? preset.dynatemp_exponent : undefined,
    smoothing_factor: preset.smoothing_factor,
    smoothing_curve: preset.smoothing_curve,
    dry_allowed_length: preset.dry_allowed_length,
    dry_multiplier: preset.dry_multiplier,
    dry_base: preset.dry_base,
    dry_sequence_breakers: st_replaceMacrosInList(preset.dry_sequence_breakers),
    dry_penalty_last_n: preset.dry_penalty_last_n,
    max_tokens_second: preset.max_tokens_second,
    sampler_priority: type === textgen_types.OOBA ? preset.sampler_priority : undefined,
    samplers: type === textgen_types.LLAMACPP ? preset.samplers : undefined,
    stopping_strings: [],
    stop: [],
    truncation_length: max_context,
    ban_eos_token: preset.ban_eos_token,
    skip_special_tokens: preset.skip_special_tokens,
    include_reasoning: preset.include_reasoning,
    top_a: preset.top_a,
    tfs: preset.tfs,
    epsilon_cutoff: [textgen_types.OOBA, textgen_types.MANCER].includes(type) ? preset.epsilon_cutoff : undefined,
    eta_cutoff: [textgen_types.OOBA, textgen_types.MANCER].includes(type) ? preset.eta_cutoff : undefined,
    mirostat_mode: preset.mirostat_mode,
    mirostat_tau: preset.mirostat_tau,
    mirostat_eta: preset.mirostat_eta,
    custom_token_bans: [],
    banned_strings: [],
    api_type: type,
    api_server: context.getTextGenServer(type),
    sampler_order: type === textgen_types.KOBOLDCPP ? preset.sampler_order : undefined,
    xtc_threshold: preset.xtc_threshold,
    xtc_probability: preset.xtc_probability,
    nsigma: preset.nsigma,
  };
  const nonAphroditeParams = {
    rep_pen: preset.rep_pen,
    rep_pen_range: preset.rep_pen_range,
    repetition_decay: type === textgen_types.TABBY ? preset.rep_pen_decay : undefined,
    repetition_penalty_range: preset.rep_pen_range,
    encoder_repetition_penalty: type === textgen_types.OOBA ? preset.encoder_rep_pen : undefined,
    no_repeat_ngram_size: type === textgen_types.OOBA ? preset.no_repeat_ngram_size : undefined,
    penalty_alpha: type === textgen_types.OOBA ? preset.penalty_alpha : undefined,
    temperature_last:
      type === textgen_types.OOBA || type === textgen_types.APHRODITE || type == textgen_types.TABBY
        ? preset.temperature_last
        : undefined,
    speculative_ngram: type === textgen_types.TABBY ? preset.speculative_ngram : undefined,
    do_sample: type === textgen_types.OOBA ? preset.do_sample : undefined,
    seed: preset.seed >= 0 ? preset.seed : undefined,
    guidance_scale: 1,
    negative_prompt: '',
    grammar_string: preset.grammar_string,
    json_schema: [textgen_types.TABBY, textgen_types.LLAMACPP].includes(type) ? preset.json_schema : undefined,
    // llama.cpp aliases. In case someone wants to use LM Studio as Text Completion API
    repeat_penalty: preset.rep_pen,
    tfs_z: preset.tfs,
    repeat_last_n: preset.rep_pen_range,
    n_predict: maxTokens,
    num_predict: maxTokens,
    num_ctx: max_context,
    mirostat: preset.mirostat_mode,
    ignore_eos: preset.ban_eos_token,
    n_probs: context.powerUserSettings.request_token_probabilities ? 10 : undefined,
    rep_pen_slope: preset.rep_pen_slope,
  };
  const vllmParams = {
    n: canMultiSwipe ? preset.n : 1,
    ignore_eos: preset.ignore_eos_token,
    spaces_between_special_tokens: preset.spaces_between_special_tokens,
    seed: preset.seed >= 0 ? preset.seed : undefined,
  };
  const aphroditeParams = {
    n: canMultiSwipe ? preset.n : 1,
    frequency_penalty: preset.freq_pen,
    presence_penalty: preset.presence_pen,
    repetition_penalty: preset.rep_pen,
    seed: preset.seed >= 0 ? preset.seed : undefined,
    stop: [],
    temperature: dynatemp ? (preset.min_temp + preset.max_temp) / 2 : preset.temp,
    temperature_last: preset.temperature_last,
    top_p: preset.top_p,
    top_k: preset.top_k,
    top_a: preset.top_a,
    min_p: preset.min_p,
    tfs: preset.tfs,
    eta_cutoff: preset.eta_cutoff,
    epsilon_cutoff: preset.epsilon_cutoff,
    typical_p: preset.typical_p,
    smoothing_factor: preset.smoothing_factor,
    smoothing_curve: preset.smoothing_curve,
    ignore_eos: preset.ignore_eos_token,
    min_tokens: preset.min_length,
    skip_special_tokens: preset.skip_special_tokens,
    spaces_between_special_tokens: preset.spaces_between_special_tokens,
    guided_grammar: preset.grammar_string,
    guided_json: preset.json_schema,
    early_stopping: false, // hacks
    include_stop_str_in_output: false,
    dynatemp_min: dynatemp ? preset.min_temp : undefined,
    dynatemp_max: dynatemp ? preset.max_temp : undefined,
    dynatemp_exponent: dynatemp ? preset.dynatemp_exponent : undefined,
    xtc_threshold: preset.xtc_threshold,
    xtc_probability: preset.xtc_probability,
    nsigma: preset.nsigma,
    custom_token_bans: [],
    no_repeat_ngram_size: preset.no_repeat_ngram_size,
    sampler_priority: undefined,
  };

  if (type === textgen_types.OPENROUTER) {
    params.provider = preset.openrouter_providers;
    params.allow_fallbacks = preset.openrouter_allow_fallbacks;
  }

  if (type === textgen_types.KOBOLDCPP) {
    params.grammar = preset.grammar_string;
    params.trim_stop = true;
  }

  if (type === textgen_types.HUGGINGFACE) {
    params.top_p = Math.min(Math.max(Number(params.top_p), 0.0), 0.999);
    params.stop = Array.isArray(params.stop) ? params.stop.slice(0, 4) : [];
    nonAphroditeParams.seed = preset.seed >= 0 ? preset.seed : Math.floor(Math.random() * Math.pow(2, 32));
  }

  if (type === textgen_types.MANCER) {
    params.n = canMultiSwipe ? preset.n : 1;
    params.epsilon_cutoff /= 1000;
    params.eta_cutoff /= 1000;
    params.dynatemp_mode = params.dynamic_temperature ? 1 : 0;
    params.dynatemp_min = params.dynatemp_low;
    params.dynatemp_max = params.dynatemp_high;
    delete params.dynatemp_low;
    delete params.dynatemp_high;
  }

  if (type === textgen_types.TABBY) {
    params.n = canMultiSwipe ? preset.n : 1;
  }

  switch (type) {
    case textgen_types.VLLM:
    case textgen_types.INFERMATICAI:
      params = Object.assign(params, vllmParams);
      break;

    case textgen_types.APHRODITE:
      // set params to aphroditeParams
      params = Object.assign(params, aphroditeParams);
      break;

    default:
      params = Object.assign(params, nonAphroditeParams);
      break;
  }

  // Grammar conflicts with with json_schema
  if (type === textgen_types.LLAMACPP) {
    if (params.json_schema && Object.keys(params.json_schema).length > 0) {
      delete params.grammar_string;
      delete params.grammar;
    } else {
      delete params.json_schema;
    }
  }

  return params;
}

export async function sendGenerateRequest(
  generate_data: any,
  url: string,
  activeApi: 'openai' | 'textgenerationwebui',
) {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(generate_data),
    headers: context.getRequestHeaders(),
    cache: 'no-cache',
    signal: new AbortController().signal, // No cancellation for now
  });
  if (!response.ok) {
    throw new Error(`Got response status ${response.status}`);
  }

  const text = await response.text();
  if (!text || !text.trim()) {
    throw new Error(`Got empty response`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Failed to parse response as JSON: ${e}`);
  }

  if (data.error) {
    const message = data.error.message || response.statusText || `Unknown error`;
    st_echo('error', message);
    throw new Error(message);
  }

  return context.extractMessageFromData(data, activeApi);
}
