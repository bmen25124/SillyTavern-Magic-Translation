import * as Handlebars from 'handlebars';

if (!Handlebars.helpers['slice']) {
  Handlebars.registerHelper('slice', function (context, count) {
    if (!Array.isArray(context)) return [];
    return context.slice(count);
  });
}

if (!Handlebars.helpers['add']) {
  Handlebars.registerHelper('add', function (value1, value2) {
    return value1 + value2;
  });
}

export function renderPromptTemplate(
  content: string,
  params: Record<string, any>,
  substituteParams: (content: string) => string,
): string {
  const prompt = substituteParams(content);
  const template = Handlebars.compile(prompt, { noEscape: true });
  return template(params);
}
