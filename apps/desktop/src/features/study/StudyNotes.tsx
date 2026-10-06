import { useEffect, useRef, useState } from 'react';
import { api, errorText } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { MarkdownBody } from '../../components/MarkdownBody';
import { clock, dateText, languageName } from '../../lib/presentation';
import type { Note, StudyState } from '../../types/domain';

export function StudyNotes({
  id,
  note,
  study,
  position,
  onSeek,
  onSaved,
  onGenerate,
  blocked,
  append,
}: {
  id: string;
  note: Note | null;
  study: StudyState;
  position: number;
  onSeek?: (n: number) => void;
  onSaved: () => Promise<void>;
  onGenerate?: () => void;
  blocked: boolean;
  append?: { key: string; body: string };
}) {
  const key = 'lecturerelay-note-draft:' + id;
  const { notify, confirm } = useWorkspace();
  const [draft, setDraft] = useState(() => {
    try {
      return localStorage.getItem(key) ?? study.draft ?? note?.body ?? '';
    } catch {
      return study.draft ?? note?.body ?? '';
    }
  });
  const [editing, setEditing] = useState(() => draft !== (note?.body ?? '')),
    [status, setStatus] = useState(''),
    [saving, setSaving] = useState(false),
    [version, setVersion] = useState('');
  const queue = useRef(Promise.resolve()),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    savingRef = useRef(false),
    latest = useRef(draft);
  const appended = useRef('');
  const persist = (body: string) => {
    queue.current = queue.current
      .catch(() => {})
      .then(() => api.saveDraft(id, body));
    return queue.current;
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const change = (value: string) => {
    if (savingRef.current) return;
    latest.current = value;
    setDraft(value);
    setStatus('正在保存草稿…');
    try {
      localStorage.setItem(key, value);
    } catch {
      setStatus('本地恢复缓存暂时不可用，正在等待数据库保存。');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void persist(value)
        .then(() => {
          if (latest.current === value) setStatus('草稿已保存在本机');
        })
        .catch((e) => setStatus(errorText(e)));
    }, 650);
  };
  const save = async (body = draft) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    if (timer.current) clearTimeout(timer.current);
    try {
      await queue.current.catch(() => {});
      await api.saveNote(id, body);
      try {
        localStorage.removeItem(key);
      } catch {
        /* SQLite is authoritative. */
      }
      latest.current = body;
      setDraft(body);
      setEditing(false);
      setVersion('');
      setStatus('已保存');
      await onSaved();
    } catch (e) {
      setStatus(errorText(e));
      notify(errorText(e), true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  useEffect(() => {
    if (!append || appended.current === append.key || saving) return;
    appended.current = append.key;
    const body = latest.current + append.body;
    if (body.length > 100000) {
      notify('笔记长度已达上限，请先导出或精简内容。', true);
      return;
    }
    change(body);
    // An explicit append should reach SQLite immediately, including a quick exit.
    if (timer.current) clearTimeout(timer.current);
    void persist(body)
      .then(() => {
        if (latest.current === body) setStatus('草稿已保存在本机');
      })
      .catch((e) => setStatus(errorText(e)));
    setEditing(true);
    setVersion('');
  }, [append, saving]);
  const selected = study.versions.find((v) => v.id === version);
  return (
    <div className="study-notes">
      <div className="study-toolbar">
        <button
          className="button secondary"
          disabled={saving}
          onClick={() => {
            setEditing(!editing);
            setVersion('');
          }}
        >
          {editing ? '预览草稿' : '编辑笔记'}
        </button>
        {onGenerate && (
          <button
            className="button secondary"
            disabled={blocked}
            onClick={onGenerate}
          >
            {'生成 AI 草稿'}
          </button>
        )}
      </div>
      {editing ? (
        <>
          <div className="study-toolbar">
            <button
              className="text-button"
              disabled={saving}
              onClick={() =>
                change(
                  draft + `\n[${clock(position)}](#t=${Math.floor(position)}) `,
                )
              }
            >
              {'+ 插入时间戳'}
              {clock(position)}
            </button>
            <span role="status" className="muted">
              {status || '已恢复的草稿'}
            </span>
          </div>
          <textarea
            className="study-note-editor"
            aria-label="课堂笔记"
            value={draft}
            disabled={saving}
            maxLength={100000}
            onChange={(e) => change(e.target.value)}
          />
          <div className="form-actions">
            <button
              className="button secondary"
              disabled={saving}
              onClick={async () => {
                if (
                  !(await confirm({
                    title: '放弃这份草稿？',
                    body: '已保存的笔记和历史版本会保留。',
                    action: '放弃草稿',
                    danger: true,
                  }))
                )
                  return;
                if (savingRef.current) return;
                savingRef.current = true;
                setSaving(true);
                if (timer.current) clearTimeout(timer.current);
                try {
                  await queue.current.catch(() => {});
                  await api.clearDraft(id);
                  try {
                    localStorage.removeItem(key);
                  } catch {
                    /* The database draft has already been cleared. */
                  }
                  setDraft(note?.body ?? '');
                  latest.current = note?.body ?? '';
                  setEditing(false);
                  setStatus('');
                } catch (e) {
                  notify(errorText(e), true);
                } finally {
                  savingRef.current = false;
                  setSaving(false);
                }
              }}
            >
              {'放弃草稿'}
            </button>
            <button
              className="button primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? '正在保存…' : '保存笔记'}
            </button>
          </div>
        </>
      ) : (
        <>
          {draft !== (note?.body ?? '') && !selected && (
            <p className="notice">
              {'有一份尚未保存为正式笔记的草稿。'}{' '}
              <button className="text-button" onClick={() => setEditing(true)}>
                {'继续编辑'}
              </button>
            </p>
          )}
          {study.versions.length > 0 && (
            <label className="version-picker">
              {'历史版本'}
              <select
                aria-label="笔记版本"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              >
                <option value="">{'当前笔记'}</option>
                {study.versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.origin === 'local'
                      ? '本地 AI 草稿'
                      : v.origin === 'cloud'
                        ? '云端 AI 草稿'
                        : '此前的笔记'}{' '}
                    · {languageName(v.language)} · {dateText(v.createdAt)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selected && (
            <div className="notice">
              <span>
                {selected.sourceVersion !== study.sourceVersion
                  ? '此版本生成后，转录文本已修改，请重新核对引用。'
                  : '此版本单独保存，不会覆盖你的笔记。'}
              </span>
              <button
                className="button secondary"
                disabled={saving}
                onClick={async () => {
                  if (
                    await confirm({
                      title: '将此版本设为当前笔记？',
                      body: '当前已保存的笔记会保留在历史版本中，尚未保存的草稿会被替换。',
                      action: '采用此版本',
                    })
                  )
                    await save(selected.body);
                }}
              >
                {'采用此版本'}
              </button>
            </div>
          )}
          {(selected?.body ?? note?.body) ? (
            <MarkdownBody body={selected?.body ?? note!.body} onSeek={onSeek} />
          ) : (
            <div className="empty-state">
              <h3>{'我的笔记'}</h3>
            </div>
          )}
        </>
      )}
    </div>
  );
}
