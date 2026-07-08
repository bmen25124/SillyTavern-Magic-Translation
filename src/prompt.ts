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

const HANDLEBARS_CONTROL_PREFIXES = ['#', '/', '!', '>', '{', '&'];

function protectExternalMacros(
  content: string,
  params: Record<string, any>,
): { content: string; restore: (content: string) => string } {
  const protectedMacros: string[] = [];
  const protectedContent = content.replace(/{{\s*([^{}\n]+?)\s*}}/g, (match, expression: string) => {
    const trimmedExpression = expression.trim();
    const firstToken = trimmedExpression.split(/\s+/)[0];

    if (
      !firstToken ||
      HANDLEBARS_CONTROL_PREFIXES.some((prefix) => firstToken.startsWith(prefix)) ||
      firstToken.startsWith('@') ||
      firstToken.startsWith('this.') ||
      firstToken in params ||
      Handlebars.helpers[firstToken]
    ) {
      return match;
    }

    const placeholder = `__MAGIC_TRANSLATION_EXTERNAL_MACRO_${protectedMacros.length}__`;
    protectedMacros.push(match);
    return placeholder;
  });

  return {
    content: protectedContent,
    restore: (renderedContent: string) =>
      protectedMacros.reduce(
        (result, macro, index) => result.replace(`__MAGIC_TRANSLATION_EXTERNAL_MACRO_${index}__`, macro),
        renderedContent,
      ),
  };
}

export function renderPromptTemplate(
  content: string,
  params: Record<string, any>,
  substituteParams: (content: string) => string,
): string {
  const protectedTemplate = protectExternalMacros(content, params);
  const template = Handlebars.compile(protectedTemplate.content, { noEscape: true });
  return substituteParams(protectedTemplate.restore(template(params)));
}
