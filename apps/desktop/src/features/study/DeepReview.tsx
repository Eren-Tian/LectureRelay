import { messageText } from '../../i18n/messages';
import { useState } from 'react';
import { api } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { useAction } from '../../hooks/useAction';
import type { ReviewCheckpoint } from '../../types/domain';

export function DeepReview({
  id,
  blocked,
  onSaved,
  reviews,
}: {
  id: string;
  blocked: boolean;
  onSaved: () => Promise<void>;
  reviews: ReviewCheckpoint[];
}) {
  const [request, setRequest] = useState('');
  const { busy, run } = useAction();
  const workspace = useWorkspace();
  const mode = workspace.data.settings.studyMode;
  return (
    <details className="settings-advanced">
      <summary>{'整堂复习'}</summary>
      <p>
        {
          '逐段整理整节课，生成带时间戳的复习指南，并单独保存。请结合原文核对，现有笔记会保留。'
        }
      </p>
      <label>
        {'你想重点复习什么？'}
        <textarea
          rows={3}
          maxLength={2000}
          value={request}
          disabled={blocked || busy}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="梳理核心概念及其联系，说明常见误区，并给出五道练习题。"
        />
      </label>
      <p className="field-hint">
        {mode === 'local'
          ? 'Qwen3.5-4B · 本地运行 · 无 API 费用'
          : mode === 'cloud'
            ? '使用所选云端服务，需发送转录文本和课程背景，服务商可能收费。'
            : '学习 AI 尚未启用，请在设置中选择模型。'}
      </p>
      <button
        className="button secondary"
        disabled={blocked || busy || !request.trim() || mode === 'none'}
        onClick={() =>
          void run(async () => {
            if (
              mode === 'cloud' &&
              !(await workspace.confirm({
                title: '生成整堂课的复习指南？',
                body: '完整转录和课程背景将发送给所选云端服务商，可能产生费用。',
                action: '生成复习指南',
              }))
            )
              return;
            try {
              await api.generateReview(id, request);
              workspace.notify('复习指南已保存，可在“历史版本”中查看。');
            } finally {
              await onSaved();
              await workspace.refresh();
            }
          })
        }
      >
        {'生成复习指南'}
      </button>
      {reviews
        .filter((review) => review.request.trim())
        .map((review) => (
          <article className="task-row" key={review.id}>
            <div>
              <strong>
                {review.publishedVersion
                  ? '复习指南已保存'
                  : '已保存的复习进度'}
              </strong>
              <p>
                {review.parts.filter((part) => part.body !== null).length} /{' '}
                {review.parts.length}
                {'段原文已整理'}
                {review.levels.length > 1
                  ? ` · ${review.levels.slice(1).reduce((n, level) => n + level.length, 0)}步综合整理已完成`
                  : ''}
                {review.recoveries
                  ? ` · ${review.recoveries}次自动分段重试`
                  : ''}
              </p>
              <p>
                {messageText(review.message) ||
                  (review.publishedVersion
                    ? ''
                    : '可以先离开，稍后继续。恢复时只处理尚未完成的部分。')}
              </p>
              <details>
                <summary>{'已保存的分段草稿（尚未全部完成）'}</summary>
                <p>{review.request || '课堂知识梳理'}</p>
                {review.parts.map((part, index) => (
                  <section key={index}>
                    <strong>
                      第 {index + 1} 段{part.body ? '' : ' · 待处理'}
                    </strong>
                    <p
                      style={{
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {part.body || '尚未生成。'}
                    </p>
                  </section>
                ))}
              </details>
            </div>
            {!review.publishedVersion && review.state !== 'stale' && (
              <button
                className="button secondary"
                disabled={blocked || busy || mode === 'none'}
                onClick={() =>
                  void run(async () => {
                    if (
                      mode === 'cloud' &&
                      !(await workspace.confirm({
                        title: '继续云端复习整理？',
                        body: '剩余文本和课程背景将发送给所选服务商，可能产生费用。',
                        action: '继续整理',
                      }))
                    )
                      return;
                    try {
                      await api.resumeReview(id, review.id);
                      workspace.notify(
                        '复习指南已保存，可在“历史版本”中查看。',
                      );
                    } finally {
                      await onSaved();
                      await workspace.refresh();
                    }
                  })
                }
              >
                {'继续整理'}
              </button>
            )}
            {review.state === 'stale' && (
              <button
                className="button secondary"
                disabled={blocked || busy}
                onClick={() => setRequest(review.request)}
              >
                {'按此要求重新生成'}
              </button>
            )}
          </article>
        ))}
    </details>
  );
}
