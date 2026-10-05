import { messageText } from '../../i18n/messages';
import { QuestionsPanel } from '../qa/QuestionsPanel';
import { NotesPanel } from '../notes/NotesPanel';
import { ui } from '../../i18n';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { listen } from '@tauri-apps/api/event';
import { api, recordingUrl } from '../../api/client';
import { type TranscriptSegment } from '../../types/domain';
import {
  clock,
  dateText,
  languageName,
  providerName,
} from '../../lib/presentation';
import { Icon } from '../../components/Icon';
import { ResourceState } from '../../components/ResourceState';
import { useAction } from '../../hooks/useAction';
import { useResource } from '../../hooks/useResource';
import { useWorkspace } from '../../app/Workspace';
import { SegmentForm } from '../transcript/SegmentForm';

export function LecturePage({ id }: { id: string }) {
  const workspace = useWorkspace();
  const load = useCallback(() => api.lecture(id), [id]);
  const { data, error, reload } = useResource(load);
  const [tab, setTab] = useState<'transcript' | 'notes' | 'questions'>(
    'transcript',
  );
  const [segment, setSegment] = useState<TranscriptSegment | 'new' | null>(
    null,
  );
  const [editingNote, setEditingNote] = useState(false);
  const [draft, setDraft] = useState('');
  const [question, setQuestion] = useState('');
  const [position, setPosition] = useState(0);
  const [search, setSearch] = useState('');
  const [speed, setSpeed] = useState(1);
  const audio = useRef<HTMLAudioElement>(null);
  const pendingSeek = useRef<number | null>(null);
  const { busy, run } = useAction();
  const ownJob = workspace.job?.lectureId === id ? workspace.job : null;
  const ownLive = workspace.live?.lectureId === id ? workspace.live : null;
  const blocked =
    busy ||
    !!workspace.job ||
    !!workspace.recording ||
    !!workspace.live?.active;
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    const subscription = listen<{ lectureId: string; state: string }>(
      'live-status',
      (e) => {
        if (e.payload.lectureId === id && e.payload.state === 'ended')
          void reload();
      },
    );
    return () => {
      void subscription.then((off) => off());
    };
  }, [id, reload]);
  useEffect(() => {
    if (!ownJob && !ownLive?.active) return;
    const interval = setInterval(() => void reload(), 4000);
    return () => clearInterval(interval);
  }, [ownJob?.lectureId, ownLive?.active, reload]);
  const closeSegment = useCallback(() => setSegment(null), []);
  if (!data) return <ResourceState error={error} reload={reload} />;
  const { lecture, course, segments, note, answers } = data;
  const query = search.trim().toLocaleLowerCase();
  const visibleSegments = segments
    .map((entry, index) => ({ entry, index }))
    .filter(
      ({ entry }) =>
        !query ||
        `${entry.sourceText}\n${entry.translatedText}`
          .toLocaleLowerCase()
          .includes(query),
    );
  const skip = (seconds: number) => {
    if (!audio.current || audio.current.readyState < 1) return;
    audio.current.currentTime = Math.max(
      0,
      Math.min(audio.current.duration, audio.current.currentTime + seconds),
    );
    setPosition(audio.current.currentTime);
  };
  const cloud = providerName(workspace.data.settings.provider);
  const configured =
    workspace.data.settings.provider !== 'none' &&
    workspace.data.providers.some(
      (provider) =>
        provider.provider === workspace.data.settings.provider &&
        provider.hasKey,
    );
  const beginAI = async (kind: 'transcription' | 'translation' | 'notes') => {
    const localSpeech =
      kind === 'transcription' &&
      workspace.data.settings.speechProvider === 'local';
    if (!configured && !localSpeech) {
      workspace.notify(ui.s096, true);
      workspace.navigate({ view: 'settings' });
      return;
    }
    const action =
      kind === 'transcription'
        ? ui.s097
        : kind === 'translation'
          ? ui.s098
          : ui.s099;
    const body =
      kind === 'transcription'
        ? localSpeech
          ? ui.localPrivacy
          : ui.s100(cloud)
        : kind === 'notes'
          ? ui.s101(
              cloud,
              note || editingNote
                ? '此操作将替换当前笔记。请先保存或导出需要保留的版本。'
                : '生成的笔记会保存在本机。',
            )
          : ui.s102(cloud);
    if (
      !(await workspace.confirm({
        title: `${action} · ${localSpeech ? ui.localSpeech : cloud}`,
        body,
        action,
      }))
    )
      return;
    setEditingNote(false);
    if (kind === 'notes') setTab('notes');
    void run(async () => {
      const pending =
        kind === 'transcription'
          ? api.transcribe(id, configured)
          : kind === 'translation'
            ? api.translate(id)
            : api.generateNotes(id);
      try {
        await pending;
        workspace.notify(ui.s103(action));
      } finally {
        await reload();
        await workspace.refresh();
      }
    });
  };
  const seek = (seconds: number) => {
    const element = audio.current;
    if (!element) return;
    if (element.readyState < 1) {
      pendingSeek.current = seconds;
      element.load();
      return;
    }
    element.currentTime = seconds;
    void element.play().catch(() => workspace.notify(ui.s104));
  };
  const exportFile = (
    kind: 'notes' | 'transcript-json' | 'transcript-markdown',
  ) =>
    void run(async () => {
      await api.export(id, kind);
      workspace.notify(ui.s105);
    });
  const saveNote = () =>
    void run(async () => {
      await api.saveNote(id, draft);
      setEditingNote(false);
      await reload();
    }, ui.s106);
  const ask = (event: FormEvent) => {
    event.preventDefault();
    if (!configured) {
      workspace.notify(ui.s107, true);
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
    }, ui.s108);
  };
  const fullyTranscribed =
    lecture.durationSeconds > 0 &&
    lecture.transcribedUntil >= lecture.durationSeconds - 0.1;
  return (
    <>
      <button
        className="breadcrumb"
        onClick={() => workspace.navigate({ view: 'course', id: course.id })}
      >
        <Icon name="back" size={16} />
        {course.name}
      </button>
      <header className="page-heading">
        <div>
          <div className="eyebrow">{'课堂回放'}</div>
          <h1>{lecture.title}</h1>
          <p>
            {dateText(lecture.startedAt)} · {clock(lecture.durationSeconds)}
            {'· 英文 →'}
            {languageName(course.assistanceLanguage)}
          </p>
        </div>
        <span
          className={`pill ${lecture.status === 'interrupted' ? 'gold' : ''}`}
        >
          {lecture.status === 'interrupted'
            ? ui.s109
            : lecture.status === 'failed'
              ? lecture.audioSource === 'import'
                ? '导入失败'
                : ui.s110
              : ui.s111}
        </span>
      </header>
      {lecture.status === 'interrupted' && (
        <div className="notice warning">{ui.s112}</div>
      )}
      {ownLive?.active && !workspace.recording && (
        <div className="job-banner" role="status">
          <div className="spinner" />
          <div>
            <strong>{ui.recordingSaved}</strong>
            <p>
              {ownLive.translationQueue
                ? ui.remainingTranslations(ownLive.translationQueue)
                : ui.remainingProcessing}
            </p>
            <p>{ui.processingHint}</p>
          </div>
        </div>
      )}
      {ownLive?.state === 'unavailable' && ownLive.message && (
        <div className="notice warning" role="alert">
          {messageText(ownLive.message)} {ui.savedAudioHint}
        </div>
      )}
      {ownLive?.translation.message &&
        segments.some(
          (segment) =>
            !segment.translatedText &&
            ownLive.translation.deferredIds.includes(segment.id),
        ) && (
          <div className="notice warning" role="status">
            {messageText(ownLive.translation.message)}
          </div>
        )}
      <section className="audio-player-panel">
        <span className="player-symbol">
          <Icon name="play" size={22} />
        </span>
        <div>
          <h3>{ui.s113}</h3>
          <p>{ui.s114}</p>
        </div>
        {lecture.durationSeconds > 0 ? (
          <audio
            ref={audio}
            src={recordingUrl(lecture.recordingPath)}
            controls
            preload="metadata"
            onTimeUpdate={(event) =>
              setPosition(event.currentTarget.currentTime)
            }
            onLoadedMetadata={(event) => {
              event.currentTarget.playbackRate = speed;
              if (pendingSeek.current !== null) {
                event.currentTarget.currentTime = pendingSeek.current;
                pendingSeek.current = null;
                void event.currentTarget.play().catch(() => {});
              }
            }}
            onError={() => workspace.notify(ui.s115, true)}
          />
        ) : (
          <span className="muted">{ui.s116}</span>
        )}
        {lecture.durationSeconds > 0 && (
          <div className="playback-tools">
            <button
              className="button secondary"
              aria-label="后退 10 秒"
              onClick={() => skip(-10)}
            >
              −10s
            </button>
            <button
              className="button secondary"
              aria-label="快进 10 秒"
              onClick={() => skip(10)}
            >
              +10s
            </button>
            <label>
              {'播放速度'}
              <select
                aria-label="播放速度"
                value={speed}
                onChange={(e) => {
                  const rate = Number(e.target.value);
                  setSpeed(rate);
                  if (audio.current) audio.current.playbackRate = rate;
                }}
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}×
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </section>
      <div className="review-nav">
        <div className="tabs" role="tablist" aria-label={ui.s117}>
          {(['transcript', 'notes', 'questions'] as const).map((item) => (
            <button
              role="tab"
              aria-selected={tab === item}
              className={tab === item ? 'active' : ''}
              key={item}
              onClick={() => setTab(item)}
            >
              {item === 'transcript'
                ? ui.s118
                : item === 'notes'
                  ? ui.s119
                  : ui.s120}
              {item === 'transcript' && <span>{segments.length}</span>}
            </button>
          ))}
        </div>
        <span className="review-mode">
          <Icon name="shield" size={15} />
          {ui.s121}
        </span>
      </div>
      {ownJob && (
        <div className="job-banner" role="status">
          <div className="spinner" />
          <div>
            <strong>
              {ownJob.kind === 'transcription'
                ? ui.s122
                : ownJob.kind === 'translation'
                  ? ui.s123
                  : ownJob.kind === 'notes'
                    ? ui.s124
                    : ui.s125}
            </strong>
            <p>
              {ownJob.total ? ui.s126(ownJob.completed, ownJob.total) : ''}
              {ownJob.cancelling ? ui.s127 : ui.s128}
            </p>
          </div>
          <button
            className="button text"
            disabled={ownJob.cancelling}
            onClick={() => void run(() => api.cancelJob())}
          >
            {ui.s129}
          </button>
        </div>
      )}
      {tab === 'transcript' && (
        <section className="review-panel">
          <div className="section-heading">
            <div>
              <h2>{ui.s130}</h2>
              <p>
                {'英文 ·'}
                {languageName(course.assistanceLanguage)}
              </p>
            </div>
            <div className="button-row">
              <button
                className="button text"
                disabled={blocked || lecture.durationSeconds <= 0}
                onClick={() => setSegment('new')}
              >
                <Icon name="plus" size={16} />
                {ui.s131}
              </button>
              <button
                className="button secondary"
                disabled={
                  blocked || !segments.some((entry) => !entry.translatedText)
                }
                onClick={() => void beginAI('translation')}
              >
                {ui.s132}
              </button>
              <button
                className="button primary"
                disabled={
                  blocked || lecture.durationSeconds <= 0 || fullyTranscribed
                }
                onClick={() => void beginAI('transcription')}
              >
                <Icon name="spark" size={17} />
                {fullyTranscribed
                  ? ui.s133
                  : lecture.transcribedUntil > 0
                    ? ui.s134
                    : ui.s135}
              </button>
            </div>
          </div>
          {segments.length > 0 && (
            <div className="transcript-search">
              <label>
                <Icon name="search" size={18} />
                <input
                  type="search"
                  aria-label="搜索转录文本"
                  placeholder="搜索英文原文或译文…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <span role="status">
                {query
                  ? `${visibleSegments.length} / ${segments.length} 段`
                  : `${segments.length} 段`}
              </span>
              {search && (
                <button className="button text" onClick={() => setSearch('')}>
                  {'清空搜索'}
                </button>
              )}
            </div>
          )}
          {segments.length ? (
            <div className="transcript-list">
              {visibleSegments.length === 0 && (
                <p className="empty-state" role="status">
                  {'没有找到匹配的字幕。'}
                </p>
              )}
              {visibleSegments.map(({ entry, index }) => (
                <article
                  className={`transcript-segment ${position >= entry.startSeconds && position < entry.endSeconds ? 'playing' : ''}`}
                  key={entry.id}
                >
                  <button
                    className="timestamp"
                    onClick={() => seek(entry.startSeconds)}
                    aria-label={ui.s136(clock(entry.startSeconds))}
                  >
                    {clock(entry.startSeconds)}
                    <Icon name="play" size={11} />
                  </button>
                  <div>
                    <p className="source-text">
                      <SearchHighlight
                        text={entry.sourceText}
                        query={search.trim()}
                      />
                    </p>
                    <p
                      className={`translated-text ${entry.translatedText ? '' : 'untranslated'}`}
                    >
                      {entry.translatedText ? (
                        <SearchHighlight
                          text={entry.translatedText}
                          query={search.trim()}
                        />
                      ) : ownLive?.active && ownLive.translationQueue > 0 ? (
                        ui.s137
                      ) : (
                        ui.noTranslationSaved
                      )}
                    </p>
                    <span className="segment-origin">
                      {entry.origin === 'manual' ? ui.s138 : ui.s139(index + 1)}
                    </span>
                  </div>
                  <button
                    className="icon-button segment-edit"
                    aria-label={ui.s140(clock(entry.startSeconds))}
                    disabled={blocked}
                    onClick={() => setSegment(entry)}
                  >
                    <Icon name="edit" size={16} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>{ui.s141}</h3>
              <p>{ui.s142}</p>
            </div>
          )}
          <div className="review-footer">
            <span>{ui.s143}</span>
            <div className="button-row">
              <button
                className="text-button"
                disabled={busy || !segments.length}
                onClick={() => exportFile('transcript-markdown')}
              >
                <Icon name="download" size={15} />
                Markdown
              </button>
              <button
                className="text-button"
                disabled={busy || !segments.length}
                onClick={() => exportFile('transcript-json')}
              >
                JSON
              </button>
            </div>
          </div>
        </section>
      )}
      {tab === 'notes' && (
        <NotesPanel
          note={note}
          lecture={lecture}
          segments={segments}
          editingNote={editingNote}
          draft={draft}
          blocked={blocked}
          busy={busy}
          setDraft={setDraft}
          setEditingNote={setEditingNote}
          beginAI={beginAI}
          saveNote={saveNote}
          exportFile={exportFile}
        />
      )}
      {tab === 'questions' && (
        <QuestionsPanel
          answers={answers}
          cloud={cloud}
          blocked={blocked}
          question={question}
          segments={segments}
          seek={seek}
          ask={ask}
          setQuestion={setQuestion}
        />
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
    </>
  );
}

function SearchHighlight({ text, query }: { text: string; query: string }) {
  if (!query) return text;
  const expression = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
    'gi',
  );
  return text
    .split(expression)
    .map((part, index) => (index % 2 ? <mark key={index}>{part}</mark> : part));
}
