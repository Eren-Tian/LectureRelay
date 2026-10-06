import { useState } from 'react';
import { api } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { useAction } from '../../hooks/useAction';
import { MarkdownBody } from '../../components/MarkdownBody';
import { clock } from '../../lib/presentation';
import { messageText } from '../../i18n/messages';
import type { StudyState } from '../../types/domain';
import { LiveSummaryPanel } from './LiveSummaryPanel';

const PAGE_SIZE = 8;

export function ClassroomSummary({
  id,
  study,
  language,
  live,
  blocked,
  canGenerate,
  onSeek,
  onSaved,
  onAppend,
}: {
  id: string;
  study: StudyState;
  language: string;
  live: boolean;
  blocked: boolean;
  canGenerate: boolean;
  onSeek?: (seconds: number) => void;
  onSaved: () => Promise<void>;
  onAppend: (body: string) => void;
}) {
  const workspace = useWorkspace();
  const { busy, run } = useAction();
  const [page, setPage] = useState(0),
    [follow, setFollow] = useState(true);
  const review = study.reviews.find(
    (r) => !r.request.trim() && r.parts.some((p) => p.startSeconds != null),
  );
  const stale =
    !!review &&
    (review.sourceVersion !== study.sourceVersion ||
      review.language !== language ||
      review.state === 'stale');
  const cards =
    review && !live
      ? review.parts.map((p) => ({
          startSeconds: p.startSeconds ?? 0,
          endSeconds: p.endSeconds ?? p.startSeconds ?? 0,
          source: p.source,
          translation: '',
          body: p.body,
        }))
      : study.sections.map((s) => ({ ...s, body: null }));
  const lastPage = Math.max(0, Math.ceil(cards.length / PAGE_SIZE) - 1);
  const current = live && follow ? lastPage : Math.min(page, lastPage);
  const done = cards.filter((c) => c.body !== null).length;
  const local = workspace.data.settings.studyMode === 'local';
  const resume =
    !!review && !stale && !review.publishedVersion && review.origin === 'local';
  const generate = () =>
    void run(async () => {
      try {
        if (resume) await api.resumeReview(id, review.id);
        else await api.generateNotes(id);
        workspace.notify('课堂要点已保存在本机。');
      } finally {
        await onSaved();
        await workspace.refresh();
      }
    });
  return (
    <div className="classroom-summary">
      <LiveSummaryPanel
        id={id}
        live={live}
        onSeek={onSeek}
        onAppend={onAppend}
      />
      {!live && (
        <details className="summary-archive">
          <summary>原文分段与课后整理</summary>
          <header className="summary-heading">
            <div>
              <h2>分段课堂要点</h2>
              <p className="field-hint">
                {live
                  ? '按约两分钟收集已定稿字幕，课后再由 AI 整理。'
                  : `${cards.length} 段课堂内容 · ${done} 段已整理`}
              </p>
            </div>
            {!live && canGenerate && local && (
              <button
                className="button primary"
                disabled={blocked || busy || !study.sections.length}
                onClick={generate}
              >
                {busy
                  ? '正在整理…'
                  : resume
                    ? '继续整理'
                    : review && !stale
                      ? '重新整理'
                      : '生成课堂要点'}
              </button>
            )}
          </header>
          {live ? (
            <p className="notice">
              上课时优先保证录音和字幕；这里的原文片段尚未经过 AI 总结。
            </p>
          ) : (
            !local && (
              <p className="notice">
                分段要点使用本地 Qwen3.5-4B。
                <button
                  className="text-button"
                  onClick={() =>
                    workspace.navigate({ view: 'settings', entry: 'services' })
                  }
                >
                  设置学习模型
                </button>
              </p>
            )
          )}
          {!live && stale && (
            <p className="notice warning">
              转录文本或整理语言已更改，下方为上次保存的要点。请重新生成后再用于复习。
            </p>
          )}
          {!live && review && !review.publishedVersion && (
            <p className="notice" role="status">
              已保存 {done} / {cards.length} 段要点。
              {messageText(review.message) || '尚未完成的片段可以继续整理。'}
            </p>
          )}
          {!cards.length && (
            <p className="summary-empty">
              第一段英文字幕定稿后，课堂片段会出现在这里。
            </p>
          )}
          {cards
            .slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
            .map((card, offset) => {
              const index = current * PAGE_SIZE + offset;
              const chapter = study.marks.filter(
                (m) =>
                  m.kind === 'chapter' &&
                  m.seconds >= card.startSeconds &&
                  m.seconds <= card.endSeconds,
              )[0];
              const stamp = `[${clock(card.startSeconds)}](#t=${card.startSeconds})`;
              return (
                <article
                  className="summary-card"
                  key={`${index}:${card.startSeconds}`}
                >
                  <header>
                    <strong>{chapter?.label || `第 ${index + 1} 段`}</strong>
                    <span className="summary-state">
                      {card.body ? 'AI 要点' : live ? '原文已收集' : '待整理'}
                    </span>
                  </header>
                  <button
                    className="text-button summary-time"
                    disabled={!onSeek}
                    aria-label={`回听第 ${index + 1} 段`}
                    onClick={() => onSeek?.(card.startSeconds)}
                  >
                    {clock(card.startSeconds)} — {clock(card.endSeconds)}
                    {onSeek ? ' · 回听' : ''}
                  </button>
                  {card.body ? (
                    <MarkdownBody body={card.body} onSeek={onSeek} />
                  ) : (
                    <p className="summary-excerpt">
                      {(card.translation || card.source).slice(0, 260)}
                      {(card.translation || card.source).length > 260
                        ? '…'
                        : ''}
                    </p>
                  )}
                  <details>
                    <summary>查看对应原文</summary>
                    <p className="summary-source">{card.source}</p>
                    {card.translation && (
                      <p className="summary-source">{card.translation}</p>
                    )}
                  </details>
                  <button
                    className="text-button"
                    onClick={() =>
                      onAppend(
                        `\n\n### 第 ${index + 1} 段 ${stamp}\n\n${card.body || card.translation || card.source}\n\n补充：`,
                      )
                    }
                  >
                    {card.body ? '加入我的笔记' : '为这段补充笔记'}
                  </button>
                </article>
              );
            })}
          {cards.length > PAGE_SIZE && (
            <nav className="summary-pages" aria-label="课堂片段分页">
              <button
                className="button secondary"
                disabled={current === 0}
                onClick={() => {
                  setFollow(false);
                  setPage(current - 1);
                }}
              >
                上一页
              </button>
              <span>
                {current + 1} / {lastPage + 1}
              </span>
              <button
                className="button secondary"
                disabled={current === lastPage}
                onClick={() => {
                  setFollow(false);
                  setPage(current + 1);
                }}
              >
                下一页
              </button>
              {live && (
                <button className="text-button" onClick={() => setFollow(true)}>
                  查看最新片段
                </button>
              )}
            </nav>
          )}
          {!live && (
            <p className="field-hint">
              AI
              要点可能有误；可展开原文核对，或点击时间范围回听。生成失败会保留已完成的片段。
            </p>
          )}
        </details>
      )}
    </div>
  );
}
