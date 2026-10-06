import { nativeMessages } from './native-messages';

const combinedMessages = Object.keys(nativeMessages).sort(
  (a, b) => b.length - a.length,
);
const lostAudio =
  /^Recording could not keep up: (\d+) audio buffers \((\d+) samples\) were lost\. Check the saved recording\./;
const missingModel =
  /^Download (.+?) in Settings → Local AI first\. No text has been uploaded\./;

/** Display native status/error fields only. Classroom text and identifiers stay untouched. */
export function messageText(message: string | null | undefined): string {
  if (!message) return '';
  if (Object.hasOwn(nativeMessages, message)) return nativeMessages[message];
  let rest = message.trim();
  const parts: string[] = [];
  while (rest) {
    const lost = rest.match(lostAudio);
    const model = rest.match(missingModel);
    const known = combinedMessages.find(
      (key) => rest === key || rest.startsWith(key + ' '),
    );
    if (lost) {
      parts.push(
        `录音未能跟上：丢失 ${lost[1]} 个音频缓冲区（${lost[2]} 个采样点）。请检查已保存的录音。`,
      );
      rest = rest.slice(lost[0].length).trim();
    } else if (model) {
      parts.push(`请先在“设置 → 本地 AI”下载 ${model[1]}。尚未上传任何文本。`);
      rest = rest.slice(model[0].length).trim();
    } else if (known) {
      parts.push(nativeMessages[known]);
      rest = rest.slice(known.length).trim();
    } else {
      // Chinese frontend messages are already ready for display. Unrecognized
      // exceptions must not expose arbitrary provider text or credentials.
      parts.push(
        /[\u3400-\u9fff]/u.test(rest)
          ? rest
          : '操作未完成，请重试；若问题持续，请重启应用。',
      );
      break;
    }
  }
  return parts.join('');
}
