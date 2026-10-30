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
import { aiReadiness } from '../../lib/ai-readiness';
import { ResourceState } from '../../components/ResourceState';
import { Icon } from '../../components/Icon';
import { StudyWorkspace } from '../../components/StudyWorkspace';
import { MarkdownBody } from '../../components/MarkdownBody';
import { StudyTools } from '../study/StudyTools';
import { QuestionsPanel } from '../qa/QuestionsPanel';
import { DeleteLecture } from './DeleteLecture';
import { SegmentForm } from '../transcript/SegmentForm';
import { ReplayControls } from './ReplayControls';
import { AddTermDialog } from '../glossary/AddTermDialog';
import { savedPosition, savePosition } from './resume';
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
    [printing, setPrinting] = useState(false),
    [playing, setPlaying] = useState(false),
    [follow, setFollow] = useState(true),
    [selection, setSelection] = useState<{
      text: string;
      x: number;
      y: number;
    } | null>(null),
    [toolRequest, setToolRequest] = useState<{ tab: string; key: number }>(),
    [focusQuestion, setFocusQuestion] = useState(false),
    [newTerm, setNewTerm] = useState<string | null>(null);
  const transcriptList = useRef<HTMLDivElement>(null),
    lastSaved = useRef(0);
  const resumeAt = useMemo(() => savedPosition(id), [id]);
  const [resumeOffered, setResumeOffered] = useState(true);
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
  const questionFocused = useCallback(() => setFocusQuestion(false), []);
  const closeTerm = useCallback(() => setNewTerm(null), []);
  const words = useMemo(
    () =>
      (data?.segments ?? []).reduce(
        (n, s) => n + s.sourceText.split(/\s+/).filter(Boolean).length,
        0,
      ),
    [data?.segments],
  );
  const duration = data?.lecture.durationSeconds ?? 0;
  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused)
      void el.play().catch(() => workspace.notify(ui.replayPressPlay));
    else el.pause();
  };
  /** Moves the playhead without starting or stopping playback. */
  const scrub = (value: number) => {
    const seconds = Math.max(0, Math.min(duration, value));
    setPosition(seconds);
    if (audio.current) audio.current.currentTime = seconds;
  };
  // Space plays or pauses and ←/→ skip 5 s, unless a control has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (
        (e.target as HTMLElement | null)?.closest(
          'input, textarea, select, button, a, [contenteditable="true"], [role="tablist"], [role="separator"], .modal',
        )
      )
        return;
      if (duration <= 0) return;
      if (e.key === ' ') toggle();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
        scrub(
          (audio.current?.currentTime ?? 0) + (e.key === 'ArrowLeft' ? -5 : 5),
        );
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  // While playing, keep the current segment in view until the reader scrolls.
  useEffect(() => {
    if (!follow || !playing) return;
    const index = filtered.findIndex(
      (s) => position >= s.startSeconds && position < s.endSeconds,
    );
    if (index < 0) return;
    if (Math.floor(index / 80) !== page) {
      setPage(Math.floor(index / 80));
      return;
    }
    const list = transcriptList.current;
    const current = list?.querySelector<HTMLElement>(
      '.transcript-segment.playing',
    );
    if (!list || !current) return;
    const box = list.getBoundingClientRect(),
      row = current.getBoundingClientRect();
    if (row.top >= box.top && row.bottom <= box.bottom) return;
    list.scrollTo({
      top: list.scrollTop + row.top - box.top - box.height / 3,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }, [position, follow, playing, filtered, page]);
  useEffect(() => {
    const clear = () => {
      if (!window.getSelection()?.toString().trim()) setSelection(null);
    };
    document.addEventListener('selectionchange', clear);
    return () => document.removeEventListener('selectionchange', clear);
  }, []);
  if (!data) return <ResourceState error={error} reload={reload} />;
  const { lecture, course, segments, answers } = data;
  const cloud = providerName(workspace.data.settings.provider);
  const readiness = (task: 'transcription' | 'translation' | 'study') =>
    aiReadiness(workspace.data.settings, workspace.data.providers, task);
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
  const pickSelection = () => {
    const picked = window.getSelection();
    const text = picked?.toString().replace(/\s+/g, ' ').trim() ?? '';
    if (
      !picked?.rangeCount ||
      text.length < 2 ||
      !(picked.anchorNode?.parentElement ?? null)?.closest('.study-workspace')
    ) {
      setSelection(null);
      return;
    }
    const box = picked.getRangeAt(0).getBoundingClientRect();
    setSelection({
      text: text.slice(0, 600),
      x: box.left + box.width / 2,
      y: box.top,
    });
  };
  const askSelection = () => {
    if (!selection) return;
    setQuestion(ui.askAboutSelectionQuestion(selection.text));
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    setToolRequest({ tab: 'questions', key: Date.now() });
    setFocusQuestion(true);
  };
  const beginAI = async (kind: 'transcription' | 'translation' | 'notes') => {
    const task = readiness(kind === 'notes' ? 'study' : kind);
    const local = task.mode === 'local';
    if (!task.configured) {
      workspace.notify(ui.chooseAiServiceFirst, true);
      workspace.navigate({ view: 'settings', entry: 'services' });
      return;
    }
    const speechName = providerName(task.provider);
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
    if (!readiness('study').configured) {
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
    <div
      className="replay-page"
      onMouseUp={pickSelection}
      onKeyUp={pickSelection}
      onScrollCapture={() => selection && setSelection(null)}
    >
      <button
        className="breadcrumb"
        onClick={() => workspace.navigate({ view: 'course', id: course.id })}
      >
        <Icon name="back" size={16} />
        {course.name}
      </button>
      <header className="page-heading replay-heading">
        <div>
          <h1>{lecture.title}</h1>
          <p>
            {dateText(lecture.startedAt)} · {clock(lecture.durationSeconds)}
            {words > 0 && <> · {ui.lectureWordCount(words)}</>}{' '}
            {ui.metaEnglishTo} {languageName(course.assistanceLanguage)}
          </p>
        </div>
        <div className="replay-heading-actions">
          <span
            className={
              'pill ' + (lecture.status === 'interrupted' ? 'gold' : '')
            }
          >
            {lecture.status === 'failed'
              ? lecture.audioSource === 'import'
                ? ui.importFailed
                : ui.recordingDidNotStart
              : lecture.status === 'interrupted'
                ? ui.recoveredRecording
                : ui.recordingSaved}
          </span>
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
      </header>
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
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={(e) => {
            setPlaying(false);
            savePosition(id, e.currentTarget.currentTime);
          }}
          onEnded={() => {
            setPlaying(false);
            savePosition(id, 0);
          }}
          onTimeUpdate={(e) => {
            const seconds = e.currentTarget.currentTime;
            setPosition(seconds);
            if (Math.abs(seconds - lastSaved.current) >= 5) {
              lastSaved.current = seconds;
              savePosition(id, seconds);
            }
          }}
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
        <ReplayControls
          playing={playing}
          position={position}
          duration={lecture.durationSeconds}
          speed={speed}
          onToggle={toggle}
          onScrub={scrub}
          resumeAt={
            resumeOffered &&
            position < 1 &&
            resumeAt > 5 &&
            resumeAt < lecture.durationSeconds - 5
              ? resumeAt
              : undefined
          }
          onResume={() => {
            setResumeOffered(false);
            scrub(resumeAt);
          }}
          onSpeed={(n) => {
            setSpeed(n);
            if (audio.current) audio.current.playbackRate = n;
          }}
        />
      </section>
      <StudyWorkspace
        reveal={toolRequest?.key}
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
              {lecture.durationSeconds > 0 && segments.length > 0 && (
                <button
                  className="text-button follow-toggle"
                  aria-pressed={follow}
                  onClick={() => setFollow(!follow)}
                >
                  {ui.transcriptFollowPlayback}
                </button>
              )}
            </div>
            <div
              className="transcript-list"
              ref={transcriptList}
              onWheel={() => playing && setFollow(false)}
            >
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
                      lang={course.assistanceLanguage}
                      dir="auto"
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
            request={toolRequest}
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
                focusRequested={focusQuestion}
                onFocused={questionFocused}
              />
            }
          />
        }
      />
      {selection && (
        <div
          className="selection-actions"
          style={{ left: selection.x, top: selection.y }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button onClick={askSelection}>
            <Icon name="spark" size={14} />
            {ui.askAiAboutSelection}
          </button>
          {/* A short phrase can become a glossary term for this course. */}
          {selection.text.length <= 60 && (
            <button
              onClick={() => {
                setNewTerm(selection.text);
                setSelection(null);
                window.getSelection()?.removeAllRanges();
              }}
            >
              <Icon name="plus" size={14} />
              {ui.addToGlossary}
            </button>
          )}
        </div>
      )}
      {newTerm !== null && (
        <AddTermDialog course={course} term={newTerm} onClose={closeTerm} />
      )}
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
              <p lang={course.assistanceLanguage} dir="auto">
                {s.translatedText}
              </p>
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
