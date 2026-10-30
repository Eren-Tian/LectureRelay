import { ui } from '../i18n';
import { LANGUAGES } from '../lib/presentation';

// The four most-used targets first; the rest in the interface's sort order.
const COMMON = new Set(['zh', 'zh-Hant', 'ja', 'ko']);
const others = LANGUAGES.filter((l) => !COMMON.has(l.value)).sort((a, b) =>
  new Intl.Collator('zh-CN').compare(a.label, b.label),
);

/** Translation language options for a <select>, grouped for scanning. */
export function LanguageOptions() {
  return (
    <>
      <optgroup label={ui.languageGroupCommon}>
        {LANGUAGES.filter((l) => COMMON.has(l.value)).map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </optgroup>
      <optgroup label={ui.languageGroupOther}>
        {others.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </optgroup>
    </>
  );
}
