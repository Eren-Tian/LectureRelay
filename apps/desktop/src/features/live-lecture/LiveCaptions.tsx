import { ui } from '../../i18n';
import { useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { clock, languageName } from '../../lib/presentation';
import { visibleTranslationPreview } from '../../lib/live-status';
import { TranslationLine } from './TranslationLine';
import type {
  AppSettings,
  AssistanceLanguage,
  LiveStatus,
  TranscriptSegment,
} from '../../types/domain';

export function LiveCaptions({
  segments,
  draft,
  translation,
  settings,
  language,
  listening,
  previews,
}: {
  segments: TranscriptSegment[];
  draft: LiveStatus['draft'];
  translation: LiveStatus['translation'];
  settings: AppSettings;
  language: AssistanceLanguage;
  listening: boolean;
  previews?: LiveStatus['translationPreviews'];
}) {
  const area = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(settings.autoScroll);
  const anchor = useRef<{ id: string; offset: number } | null>(null);
  const [atLive, setAtLive] = useState(true);
  const remember = () => {
    const el = area.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const item = Array.from(
      el.querySelectorAll<HTMLElement>('[data-caption-id]'),
    ).find((item) => item.getBoundingClientRect().bottom > top + 1);
    anchor.current = item
      ? {
          id: item.dataset.captionId!,
          offset: item.getBoundingClientRect().top - top,
        }
      : null;
  };
  const position = () => {
    const el = area.current;
    if (!el) return;
    if (following.current) el.scrollTop = el.scrollHeight;
    else if (anchor.current) {
      const item = Array.from(
        el.querySelectorAll<HTMLElement>('[data-caption-id]'),
      ).find((item) => item.dataset.captionId === anchor.current!.id);
      if (item)
        el.scrollTop +=
          item.getBoundingClientRect().top -
          el.getBoundingClientRect().top -
          anchor.current.offset;
    }
    setAtLive(el.scrollHeight - el.scrollTop - el.clientHeight < 8);
    remember();
  };
  useLayoutEffect(position, [
    segments,
    draft,
    settings.englishFontSize,
    settings.translationFontSize,
    settings.showEnglish,
    settings.showTranslation,
    translation,
    previews,
  ]);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(position);
    if (content.current) observer.observe(content.current);
    if (area.current) observer.observe(area.current);
    return () => observer.disconnect();
  }, []);
  const target = languageName(language);
  const draftPreview =
    draft &&
    visibleTranslationPreview(
      previews,
      `${draft.id}:0`,
      draft.partialText,
      language,
    );
  return (
    <div className="caption-reader">
      <div
        className="caption-scroll"
        ref={area}
        tabIndex={0}
        aria-label={ui.liveCaptions}
        onWheel={(e) => {
          if (e.deltaY < 0) following.current = false;
        }}
        onKeyDown={(e) => {
          if (['ArrowUp', 'PageUp', 'Home'].includes(e.key))
            following.current = false;
        }}
        onScroll={() => {
          const el = area.current!;
          const near = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
          following.current = settings.autoScroll && near;
          setAtLive(near);
          remember();
        }}
      >
        <div className="caption-content" ref={content}>
          {!segments.length && !draft?.partialText && (
            <div className="caption-placeholder">
              <Icon name="books" size={28} />
              <h3>
                {listening
                  ? ui.captionsWaitingForAudioTitle
                  : ui.captionsSavingRecordingTitle}
              </h3>
              <p>
                {listening
                  ? settings.translationMode === 'local' && translation.enabled
                    ? ui.captionsPlaceholderLocalTranslationHint
                    : ui.captionsPlaceholderHint
                  : ui.captionsOffHint}
              </p>
            </div>
          )}
          {[
            ...segments.map((segment) => {
              const preview =
                !segment.translatedText &&
                visibleTranslationPreview(
                  previews,
                  segment.id,
                  segment.sourceText,
                  language,
                );
              return (
                <article
                  className="live-caption"
                  data-caption-id={segment.id}
                  key={segment.id}
                >
                  <time>{clock(segment.startSeconds)}</time>
                  {settings.showEnglish && (
                    <p
                      className="caption-english"
                      lang="en"
                      style={{ fontSize: settings.englishFontSize }}
                    >
                      {segment.sourceText}
                    </p>
                  )}
                  {settings.showTranslation && (
                    <div className="translation-slot">
                      {segment.translatedText ? (
                        <p
                          className="caption-translation"
                          lang={language}
                          style={{ fontSize: settings.translationFontSize }}
                        >
                          {segment.translatedText}
                        </p>
                      ) : preview ? (
                        <TranslationLine
                          preview={preview}
                          size={settings.translationFontSize}
                        />
                      ) : (
                        <p className="translation-placeholder">
                          {!translation.enabled
                            ? ui.captionsTranslationOff
                            : !translation.configured
                              ? settings.translationMode === 'local'
                                ? ui.captionsDownloadTranslationModel
                                : ui.captionsChooseTranslationProvider
                              : translation.deferredIds.includes(segment.id)
                                ? ui.captionsTranslateAfterClass
                                : translation.pendingIds.includes(segment.id)
                                  ? ui.captionsTranslatingTo(target)
                                  : ui.captionsTranslationFailed}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              );
            }),
            draft?.partialText && (
              <article
                className="live-caption caption-draft"
                data-caption-id={`${draft.id}:0`}
                key={`${draft.id}:0`}
              >
                <time>
                  {clock(draft.startSeconds)}
                  <span>{ui.captionsDraftBadge}</span>
                </time>
                {settings.showEnglish && (
                  <p
                    className="caption-english"
                    lang="en"
                    style={{ fontSize: settings.englishFontSize }}
                  >
                    {draft.partialText}
                  </p>
                )}
                {settings.showTranslation && (
                  <div className="translation-slot">
                    {draftPreview ? (
                      <TranslationLine
                        preview={draftPreview}
                        size={settings.translationFontSize}
                      />
                    ) : (
                      <p className="translation-placeholder">
                        {translation.enabled && translation.configured
                          ? settings.translationMode === 'local'
                            ? ui.captionsDraftLocalWaiting(target)
                            : ui.captionsDraftCloudWaiting(target)
                          : !settings.showEnglish
                            ? ui.captionsRecognizingEnglish
                            : ui.captionsSentenceInProgress}
                      </p>
                    )}
                  </div>
                )}
              </article>
            ),
          ]}
        </div>
      </div>
      {!atLive && (
        <button
          className="button secondary jump-live"
          onClick={() => {
            following.current = settings.autoScroll;
            const el = area.current;
            if (el) el.scrollTop = el.scrollHeight;
            setAtLive(true);
            remember();
          }}
        >
          {ui.jumpToLive}
          <Icon name="arrow" size={16} />
        </button>
      )}
    </div>
  );
}
