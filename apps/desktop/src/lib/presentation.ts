import { ui } from '../i18n';
import type { ExportKind } from '../types/domain';

export const LANGUAGES = [
  { value: 'zh', label: ui.s002 },
  { value: 'ja', label: ui.s003 },
  { value: 'ko', label: '韩语' },
] as const;
export const SUBJECTS = [
  'Computer Science',
  'Engineering',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology / Medicine',
  'Business / Economics',
  'Social Sciences',
  'Humanities',
  'Geography / Earth Science',
  'Law',
  'Other',
];
export const languageName = (language: string) =>
  language === 'en'
    ? '英文'
    : (LANGUAGES.find((entry) => entry.value === language)?.label ?? ui.s004);
const subjectLabels: Record<string, string> = {
  'Computer Science': '计算机科学',
  Engineering: '工程',
  Mathematics: '数学',
  Physics: '物理',
  Chemistry: '化学',
  'Biology / Medicine': '生物学与医学',
  'Business / Economics': '商科与经济学',
  'Social Sciences': '社会科学',
  Humanities: '人文',
  'Geography / Earth Science': '地理与地球科学',
  Law: '法学',
  Other: '其他',
};
export const subjectName = (subject: string) =>
  subjectLabels[subject] ?? subject;
const exportLabels: Record<ExportKind, string> = {
  notes: '笔记（Markdown）',
  'transcript-json': '转录数据（JSON）',
  'transcript-markdown': '转录文本（Markdown）',
  'srt-source': '英文字幕（SRT）',
  'srt-translation': '译文字幕（SRT）',
  'srt-bilingual': '双语字幕（SRT）',
  'vtt-source': '英文字幕（VTT）',
  'vtt-translation': '译文字幕（VTT）',
  'vtt-bilingual': '双语字幕（VTT）',
};
export const exportName = (kind: ExportKind) => exportLabels[kind];
export const taskName = (kind: string) =>
  (
    ({
      transcription: '转录录音',
      translation: '翻译文本',
      notes: '生成笔记',
      review: '整理复习指南',
      question: '课堂问答',
      'provider-test': '测试服务连接',
      'live-captions': '实时字幕',
      import: '导入音视频',
    }) as Record<string, string>
  )[kind] ?? 'AI 处理';
export const taskStateName = (state: string) =>
  (
    ({
      running: '处理中',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消',
      interrupted: '已中断',
      stale: '原文已更新',
    }) as Record<string, string>
  )[state] ?? '待处理';
export const providerName = (provider: string) =>
  provider === 'openai' ? 'OpenAI' : provider === 'groq' ? 'Groq' : ui.s005;
export const clock = (seconds: number) => {
  const total = Math.floor(Math.max(0, seconds));
  const parts =
    total >= 3600
      ? [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
      : [Math.floor(total / 60), total % 60];
  return parts.map((part) => String(part).padStart(2, '0')).join(':');
};
export const dateText = (seconds: number) =>
  new Date(seconds * 1000).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
