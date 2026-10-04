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
import { SegmentForm } from '../transcript/SegmentForm';
import {
  clock,
  dateText,
  languageName,
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
    void el.play().catch(() => workspace.notify('Press Play to start audio.'));
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
      workspace.notify('Choose an AI provider in Settings.', true);
      workspace.navigate({ view: 'settings' });
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
            ? 'Generate an AI draft?'
            : kind === 'transcription'
              ? 'Continue transcription?'
              : 'Translate missing segments?',
        body: local
          ? 'Audio is processed on this device. Translation is a separate action.'
          : kind === 'transcription'
            ? `Audio will be sent to ${speechName}. Provider charges may apply. Saved segments are preserved.`
            : `Transcript text and course context will be sent to ${cloud}. Provider charges may apply. ${kind === 'notes' ? 'A new draft is saved separately; your notes stay available.' : 'Only missing translations are processed.'}`,
        action: local ? 'Transcribe locally' : 'Continue',
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
          kind === 'notes'
            ? 'AI draft saved in Notes → Saved versions.'
            : 'Processing complete.',
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
      workspace.notify('Configure a text provider in Settings.', true);
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
      workspace.notify('Export saved.');
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
            {dateText(lecture.startedAt)} · {clock(lecture.durationSeconds)} ·
            English → {languageName(course.assistanceLanguage)}
          </p>
        </div>
        <span
          className={'pill ' + (lecture.status === 'interrupted' ? 'gold' : '')}
        >
          {lecture.status === 'failed'
            ? lecture.audioSource === 'import'
              ? 'Import failed'
              : 'Recording did not start'
            : lecture.status === 'interrupted'
              ? 'Recovered audio'
              : 'Audio saved'}
        </span>
      </header>
      {data.recordingWarning && (
        <p role="status" className="notice warning">
          {data.recordingWarning}
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
            <strong>Recording saved</strong>
            <p>
              {live.translationQueue
                ? `${live.translationQueue} translation batches remaining.`
                : 'Remaining captions are processing.'}{' '}
              You can play the saved audio now.
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => void api.cancelLive()}
          >
            Stop processing
          </button>
        </div>
      )}
      {ownJob && (
        <div className="job-banner" role="status">
          <div className="spinner" />
          <div>
            <strong>{ownJob.kind}</strong>
            <p>
              {ownJob.total
                ? `${ownJob.completed} / ${ownJob.total}`
                : 'Working…'}{' '}
              ·{' '}
              {ownJob.cancelling
                ? 'Cancelling…'
                : ownJob.message || 'Audio is saved.'}
            </p>
          </div>
          <button
            className="button secondary"
            disabled={ownJob.cancelling}
            onClick={() => void api.cancelJob()}
          >
            Cancel
          </button>
        </div>
      )}
      <section className="replay-player" aria-label="Lecture audio">
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
          onError={() =>
            workspace.notify('Saved audio is missing or unreadable.', true)
          }
        />
        <div className="playback-tools">
          <button
            className="button secondary"
            aria-label="Back 10 seconds"
            onClick={() => seek(position - 10)}
          >
            −10s
          </button>
          <button
            className="button secondary"
            aria-label="Forward 10 seconds"
            onClick={() => seek(position + 10)}
          >
            +10s
          </button>
          <select
            aria-label="Playback speed"
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
              <h2>Transcript</h2>
              <div className="button-row">
                <button
                  className="text-button"
                  disabled={blocked || lecture.durationSeconds <= 0}
                  onClick={() => setSegment('new')}
                >
                  + Segment
                </button>
                <button
                  className="button secondary"
                  disabled={blocked || !segments.some((s) => !s.translatedText)}
                  onClick={() => void beginAI('translation')}
                >
                  Translate missing
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
                    ? 'Resume transcription'
                    : 'Transcribe'}
                </button>
              </div>
            </div>
            <div className="transcript-search">
              <label>
                <Icon name="search" size={17} />
                <input
                  type="search"
                  aria-label="Search transcript"
                  placeholder="Search English or translation…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <span>{filtered.length} segments</span>
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
                        'Translation not saved'
                      )}
                    </p>
                  </div>
                  <button
                    className="icon-button segment-edit"
                    aria-label={'Edit segment at ' + clock(s.startSeconds)}
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
                      ? 'No matching segments'
                      : 'Your transcript will appear here'}
                  </h3>
                  <p>
                    {search
                      ? 'Try a different word.'
                      : 'Transcribe the saved audio or add a segment yourself.'}
                  </p>
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
                  Previous
                </button>
                <span>
                  {currentPage + 1} / {pages}
                </span>
                <button
                  className="button secondary"
                  disabled={currentPage === pages - 1}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
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
                  Current audio
                </button>
              </div>
            )}
            <div className="review-footer">
              <select
                aria-label="Export format"
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
                    {f.replaceAll('-', ' ')}
                  </option>
                ))}
              </select>
              <button
                className="text-button"
                disabled={busy}
                onClick={exportFile}
              >
                <Icon name="download" size={15} />
                Export
              </button>
              <button className="text-button" disabled={busy} onClick={print}>
                Print / PDF
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
                  settings.studyMode === 'local' ? 'Qwen3.5 · local' : cloud
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
              <h2>Notes</h2>
              <MarkdownBody body={data.note.body} />
            </>
          )}
          <h2>Transcript</h2>
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
