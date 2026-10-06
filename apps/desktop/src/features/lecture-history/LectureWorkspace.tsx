import { messageText } from '../../i18n/messages';
import { ui } from '../../i18n';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { api, recordingUrl } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { useResource } from '../../hooks/useResource';
import { useAction } from '../../hooks/useAction';
import { ResourceState } from '../../components/ResourceState';
import { Icon } from '../../components/Icon';
import { StudyWorkspace } from '../../components/StudyWorkspace';
import { MarkdownBody } from '../../components/MarkdownBody';
import { StudyTools } from '../study/StudyTools';
import { QuestionsPanel } from '../qa/QuestionsPanel';
import { DeleteLecture } from './DeleteLecture';
import { SegmentForm } from '../transcript/SegmentForm';
import {
  clock,
  exportName,
  dateText,
  languageName,
  taskName,
  providerName,
} from '../../lib/presentation';
import type { ExportKind, TranscriptSegment } from '../../types/domain';

export function LecturePage({ id }: { id: string }) {
  const workspace = useWorkspace();
  const load = useCallback(() => api.lecture(id), [id]);
  const { data, error, reload } = useResource(load);
  const { busy, run } = useAction();
  const audio = useRef<HTMLAudioElement>(null),
    pendingSeek = useRef<number | null>(null);
  const [position, setPosition] = useState(0),
    [speed, setSpeed] = useState(1),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(0),
    [question, setQuestion] = useState(''),
    [segment, setSegment] = useState<TranscriptSegment | 'new' | null>(null),
    [format, setFormat] = useState<ExportKind>('srt-bilingual'),
    [printing, setPrinting] = useState(false);
  const ownJob = workspace.job?.lectureId === id ? workspace.job : null,
    live = workspace.live?.lectureId === id ? workspace.live : null;
  const blocked =
    busy ||
    !!workspace.job ||
    !!workspace.recording ||
    !!workspace.live?.active;
  useEffect(() => {
    void reload();
  }, [reload, ownJob?.kind, live?.active]);
  useEffect(() => {
    if (!ownJob && !live?.active) return;
    const timer = setInterval(() => void reload(), 4000);
    return () => clearInterval(timer);
  }, [ownJob?.kind, live?.active, reload]);
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return (data?.segments ?? []).filter(
      (s) =>
        !q ||
        `${s.sourceText}\n${s.translatedText}`.toLocaleLowerCase().includes(q),
    );
  }, [data?.segments, search]);
  const closeSegment = useCallback(() => setSegment(null), []);
  if (!data) return <ResourceState error={error} reload={reload} />;
  const { lecture, course, segments, answers } = data;
  const cloud = providerName(workspace.data.settings.provider);
  const configured =
    workspace.data.settings.provider !== 'none' &&
    workspace.data.providers.some(
      (p) => p.provider === workspace.data.settings.provider && p.hasKey,
    );
  const seek = (value: number) => {
    const seconds = Math.max(0, Math.min(lecture.durationSeconds, value));
    setPosition(seconds);
    const el = audio.current;
    if (!el) return;
    if (el.readyState < 1) {
      pendingSeek.current = seconds;
      el.load();
      return;
    }
    el.currentTime = seconds;
    void el.play().catch(() => workspace.notify(ui.replayPressPlay));
  };
  const beginAI = async (kind: 'transcription' | 'translation' | 'notes') => {
    const local =
      kind === 'transcription'
        ? workspace.data.settings.speechProvider === 'local'
        : (kind === 'translation'
            ? workspace.data.settings.translationMode
            : workspace.data.settings.studyMode) === 'local';
    const off =
      kind === 'transcription'
        ? false
        : (kind === 'translation'
            ? workspace.data.settings.translationMode
            : workspace.data.settings.studyMode) === 'none';
    if (off || (!local && !configured)) {
      workspace.notify(ui.chooseAiServiceFirst, true);
      workspace.navigate({ view: 'settings', entry: 'services' });
      return;
    }
    const speechName = providerName(
      workspace.data.settings.speechProvider === 'none'
        ? workspace.data.settings.provider
        : (workspace.data.settings.speechProvider as 'openai' | 'groq'),
    );
    if (
      !local &&
      !(await workspace.confirm({
        title:
          kind === 'notes'
            ? ui.aiNotesDraftTitle
            : kind === 'transcription'
              ? ui.continueTranscriptionTitle
              : ui.fillMissingTranslationsTitle,
        body: local
          ? ui.localTranscriptionBody
          : kind === 'transcription'
            ? ui.cloudTranscriptionBody(speechName)
            : ui.cloudTextBody(
                cloud,
                kind === 'notes'
                  ? ui.notesDraftKeepsExisting
                  : ui.translateOnlyMissing,
              ),
        action: local ? ui.transcribeLocally : ui.continueAction,
      }))
    )
      return;
    void run(async () => {
      try {
        await (kind === 'transcription'
          ? api.transcribe(id, false)
          : kind === 'translation'
            ? api.translate(id)
            : api.generateNotes(id));
        workspace.notify(
          kind === 'notes' ? ui.keyPointsSaved : ui.processingComplete,
        );
      } finally {
        await reload();
        await workspace.refresh();
      }
    });
  };
  const ask = (e: FormEvent) => {
    e.preventDefault();
    if (
      workspace.data.settings.studyMode === 'none' ||
      (workspace.data.settings.studyMode === 'cloud' && !configured)
    ) {
      workspace.notify(ui.configureTextAiFirst, true);
      return;
    }
    void run(async () => {
      try {
        await api.ask(id, question);
        setQuestion('');
      } finally {
        await reload();
        await workspace.refresh();
      }
    });
  };
  const pages = Math.max(1, Math.ceil(filtered.length / 80)),
    currentPage = Math.min(page, pages - 1),
    visible = filtered.slice(currentPage * 80, (currentPage + 1) * 80);
  const exportFile = () =>
    void run(async () => {
      await api.export(id, format);
      workspace.notify(ui.exportSaved);
    });
  const print = () =>
    void run(async () => {
      setPrinting(true);
      try {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        await api.print();
      } finally {
        setPrinting(false);
      }
    });
  const settings = workspace.data.settings;
  return (
    <div className="replay-page">
      <button
        className="breadcrumb"
        onClick={() => workspace.navigate({ view: 'course', id: course.id })}
      >
        <Icon name="back" size={16} />
        {course.name}
      </button>
      <header className="page-heading">
        <div>
          <h1>{lecture.title}</h1>
          <p>
            {dateText(lecture.startedAt)} · {clock(lecture.durationSeconds)}
            {ui.metaEnglishTo}
            {languageName(course.assistanceLanguage)}
          </p>
        </div>
        <span
          className={'pill ' + (lecture.status === 'interrupted' ? 'gold' : '')}
        >
          {lecture.status === 'failed'
            ? lecture.audioSource === 'import'
              ? ui.importFailed
              : ui.recordingDidNotStart
            : lecture.status === 'interrupted'
              ? ui.recoveredRecording
              : ui.recordingSaved}
        </span>
      </header>
      <div className="button-row replay-actions">
        <DeleteLecture
          lecture={lecture}
          beforeDelete={() => {
            const player = audio.current;
            if (player) {
              const source = player.src;
              player.pause();
              player.removeAttribute('src');
              player.load();
              return () => {
                player.src = source;
                player.load();
              };
            }
          }}
          onDeleted={() =>
            workspace.navigate({ view: 'course', id: course.id })
          }
        />
      </div>
      {data.recordingWarning && (
        <p role="status" className="notice warning">
          {messageText(data.recordingWarning)}
        </p>
      )}
      {error && (
        <p role="alert" className="notice warning">
          {error}
        </p>
      )}
      {live?.active && (
        <div className="job-banner" role="status">
          <div className="spinner" />
          <div>
            <strong>{ui.recordingSaved}</strong>
            <p>
              {live.translationQueue
                ? ui.translationBatchesPending(live.translationQueue)
                : ui.processingRemainingCaptions}{' '}
              {ui.savedRecordingPlayableNow}
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => void api.cancelLive()}
          >
            {ui.stopProcessing}
          </button>
        </div>
      )}
      {ownJob && (
        <div className="job-banner" role="status">
          <div className="spinner" />
          <div>
            <strong>{taskName(ownJob.kind)}</strong>
            <p>
              {ownJob.total
                ? `${ownJob.completed} / ${ownJob.total}`
                : ui.processing}{' '}
              ·{' '}
              {ownJob.cancelling
                ? ui.cancelling
                : messageText(ownJob.message) || ui.recordingSavedNotice}
            </p>
          </div>
          <button
            className="button secondary"
            disabled={ownJob.cancelling}
            onClick={() => void api.cancelJob()}
          >
            {ui.cancel}
          </button>
        </div>
      )}
      <section className="replay-player" aria-label={ui.lectureRecording}>
        <audio
          ref={audio}
          src={recordingUrl(lecture.recordingPath)}
          controls
          preload="metadata"
          onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            e.currentTarget.playbackRate = speed;
            if (pendingSeek.current !== null) {
              e.currentTarget.currentTime = pendingSeek.current;
              pendingSeek.current = null;
              void e.currentTarget.play().catch(() => {});
            }
          }}
          onError={() => workspace.notify(ui.recordingUnreadable, true)}
        />
        <div className="playback-tools">
          <button
            className="button secondary"
            aria-label={ui.rewind10Seconds}
            onClick={() => seek(position - 10)}
          >
            −10s
          </button>
          <button
            className="button secondary"
            aria-label={ui.forward10Seconds}
            onClick={() => seek(position + 10)}
          >
            +10s
          </button>
          <select
            aria-label={ui.playbackSpeed}
            value={speed}
            onChange={(e) => {
              const n = Number(e.target.value);
              setSpeed(n);
              if (audio.current) audio.current.playbackRate = n;
            }}
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
        </div>
      </section>
      <StudyWorkspace
        primary={
          <section className="review-panel transcript-panel">
            <div className="section-heading">
              <h2>{ui.transcript}</h2>
              <div className="button-row">
                <button
                  className="text-button"
                  disabled={blocked || lecture.durationSeconds <= 0}
                  onClick={() => setSegment('new')}
                >
                  {ui.addSegmentWithPlus}
                </button>
                <button
                  className="button secondary"
                  disabled={blocked || !segments.some((s) => !s.translatedText)}
                  onClick={() => void beginAI('translation')}
                >
                  {ui.fillMissingTranslations}
                </button>
                <button
                  className="button primary"
                  disabled={
                    blocked ||
                    lecture.durationSeconds <= 0 ||
                    lecture.transcribedUntil >= lecture.durationSeconds - 0.1
                  }
                  onClick={() => void beginAI('transcription')}
                >
                  {lecture.transcribedUntil > 0
                    ? ui.continueTranscription
                    : ui.transcribeRecording}
                </button>
              </div>
            </div>
            <div className="transcript-search">
              <label>
                <Icon name="search" size={17} />
                <input
                  type="search"
                  aria-label={ui.searchTranscript}
                  placeholder={ui.searchTranscriptPlaceholder}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <span>
                {filtered.length}
                {ui.segmentCountSuffix}
              </span>
            </div>
            <div className="transcript-list">
              {visible.map((s) => (
                <article
                  key={s.id}
                  className={
                    'transcript-segment ' +
                    (position >= s.startSeconds && position < s.endSeconds
                      ? 'playing'
                      : '')
                  }
                >
                  <button
                    className="timestamp"
                    onClick={() => seek(s.startSeconds)}
                  >
                    {clock(s.startSeconds)}
                  </button>
                  <div>
                    <p
                      className="source-text"
                      style={{
                        fontSize: Math.max(16, settings.englishFontSize - 3),
                      }}
                    >
                      <Highlight text={s.sourceText} query={search.trim()} />
                    </p>
                    <p
                      className={
                        'translated-text ' +
                        (!s.translatedText ? 'untranslated' : '')
                      }
                      style={{
                        fontSize: Math.max(16, settings.translationFontSize),
                      }}
                    >
                      {s.translatedText ? (
                        <Highlight
                          text={s.translatedText}
                          query={search.trim()}
                        />
                      ) : (
                        ui.noTranslationSaved
                      )}
                    </p>
                  </div>
                  <button
                    className="icon-button segment-edit"
                    aria-label={ui.editCaptionAt(clock(s.startSeconds))}
                    disabled={blocked}
                    onClick={() => setSegment(s)}
                  >
                    <Icon name="edit" size={15} />
                  </button>
                </article>
              ))}
              {!visible.length && (
                <div className="empty-state">
                  <h3>
                    {search
                      ? ui.noMatchingSegmentsTitle
                      : ui.transcriptEmptyTitle}
                  </h3>
                  <p>{search ? ui.tryOtherKeywords : ui.transcriptEmptyBody}</p>
                </div>
              )}
            </div>
            {pages > 1 && (
              <div className="transcript-pages">
                <button
                  className="button secondary"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  {ui.previousPage}
                </button>
                <span>
                  {currentPage + 1} / {pages}
                </span>
                <button
                  className="button secondary"
                  disabled={currentPage === pages - 1}
                  onClick={() => setPage(currentPage + 1)}
                >
                  {ui.nextPage}
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    const index = filtered.findIndex(
                      (s) =>
                        position >= s.startSeconds && position < s.endSeconds,
                    );
                    if (index >= 0) setPage(Math.floor(index / 80));
                  }}
                >
                  {ui.currentPlaybackPage}
                </button>
              </div>
            )}
            <div className="review-footer">
              <select
                aria-label={ui.exportFormat}
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportKind)}
              >
                {(
                  [
                    'srt-bilingual',
                    'srt-source',
                    'srt-translation',
                    'vtt-bilingual',
                    'vtt-source',
                    'vtt-translation',
                    'transcript-markdown',
                    'transcript-json',
                    'notes',
                  ] as ExportKind[]
                ).map((f) => (
                  <option key={f} value={f}>
                    {exportName(f)}
                  </option>
                ))}
              </select>
              <button
                className="text-button"
                disabled={busy}
                onClick={exportFile}
              >
                <Icon name="download" size={15} />
                {ui.exportAction}
              </button>
              <button className="text-button" disabled={busy} onClick={print}>
                {ui.printOrSavePdf}
              </button>
            </div>
          </section>
        }
        secondary={
          <StudyTools
            detail={data}
            position={position}
            onSeek={seek}
            onReload={reload}
            onAI={(kind) => void beginAI(kind)}
            questions={
              <QuestionsPanel
                answers={answers}
                cloud={
                  settings.studyMode === 'local' ? ui.localQaModelLabel : cloud
                }
                local={settings.studyMode === 'local'}
                blocked={blocked}
                question={question}
                segments={segments}
                seek={seek}
                ask={ask}
                setQuestion={setQuestion}
              />
            }
          />
        }
      />
      {segment && (
        <SegmentForm
          lectureId={id}
          duration={lecture.durationSeconds}
          language={course.assistanceLanguage}
          segment={segment === 'new' ? undefined : segment}
          onClose={closeSegment}
          onSaved={reload}
        />
      )}
      {printing && (
        <article className="print-sheet">
          <h1>{lecture.title}</h1>
          <p>
            {course.name} · {dateText(lecture.startedAt)} ·{' '}
            {languageName(course.assistanceLanguage)}
          </p>
          {data.note && (
            <>
              <h2>{ui.notes}</h2>
              <MarkdownBody body={data.note.body} />
            </>
          )}
          <h2>{ui.transcript}</h2>
          {segments.map((s) => (
            <section key={s.id}>
              <h3>{clock(s.startSeconds)}</h3>
              <p>{s.sourceText}</p>
              <p>{s.translatedText}</p>
            </section>
          ))}
        </article>
      )}
    </div>
  );
}
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return text;
  const re = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
    'gi',
  );
  return text
    .split(re)
    .map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}
