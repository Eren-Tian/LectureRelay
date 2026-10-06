import {
  externalMessages,
  nativeMessages,
  nativeTemplates,
} from './native-messages';

const exactMessages: Record<string, string> = {
  ...externalMessages,
  ...nativeMessages,
};
const combinedMessages = Object.keys(exactMessages).sort(
  (a, b) => b.length - a.length,
);
const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templates = Object.entries(nativeTemplates).map(([english, chinese]) => ({
  pattern: new RegExp(
    '^' + english.split('{}').map(escapeRegExp).join('(.+?)'),
  ),
  chinese,
}));

function templateText(rest: string): { text: string; length: number } | null {
  for (const { pattern, chinese } of templates) {
    const match = rest.match(pattern);
    if (!match) continue;
    let value = 1;
    return {
      text: chinese.replace(/\{\}/g, () => match[value++]),
      length: match[0].length,
    };
  }
  return null;
}

/** Display native status/error fields only. Classroom text and identifiers stay untouched. */
export function messageText(message: string | null | undefined): string {
  if (!message) return '';
  if (Object.hasOwn(exactMessages, message)) return exactMessages[message];
  let rest = message.trim();
  const parts: string[] = [];
  while (rest) {
    const filled = templateText(rest);
    const known = combinedMessages.find(
      (key) => rest === key || rest.startsWith(key + ' '),
    );
    if (filled) {
      parts.push(filled.text);
      rest = rest.slice(filled.length).trim();
    } else if (known) {
      parts.push(exactMessages[known]);
      rest = rest.slice(known.length).trim();
    } else {
      // Chinese frontend messages are already ready for display. Unrecognized
      // exceptions must not expose arbitrary provider text or credentials.
      parts.push(
        /[㐀-鿿]/u.test(rest)
          ? rest
          : '操作未完成，请重试；若问题持续，请重启应用。',
      );
      break;
    }
  }
  return parts.join('');
}
