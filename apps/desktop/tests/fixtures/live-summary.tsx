// Isolated UI fixtures. Never reads credentials or sends a provider request.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkspaceProvider } from '../../src/app/Workspace';
import { LiveSummaryPanel } from '../../src/features/study/LiveSummaryPanel';
import {
  LiveSummarySetup,
  defaultSummaryPreferences,
} from '../../src/features/study/LiveSummarySetup';
import { api } from '../../src/api/client';
import type { Bootstrap, SummaryState } from '../../src/types/domain';
import '../../src/styles/app.css';

const data = {
  settings: {
    liveSummaries: { ...defaultSummaryPreferences },
    theme: 'light',
    speechProvider: 'local',
    translationMode: 'local',
    studyMode: 'local',
  },
  courses: [],
  providers: [],
  storage: {},
  recording: null,
  job: null,
  recoveredCount: 0,
} as unknown as Bootstrap;
const state: SummaryState = {
  cards: [],
  busy: false,
  message: '',
  remaining: 3,
  collectingSeconds: 240,
};
const fixture = {
  calls: [] as string[],
  hasKey: false,
  tested: false,
  notes: '我自己的课堂笔记',
  seek: -1,
  settle: () => {},
  stale: () => {},
  refresh: () => {},
  live: (_live: boolean) => {},
};
Object.assign(window, { liveSummaryFixture: fixture });
api.summaryState = async () => structuredClone(state);
api.summarySetup = async () => ({
  preferences: { ...data.settings.liveSummaries },
  providers: [
    {
      provider: 'groq',
      hasKey: fixture.hasKey,
      maskedKey: fixture.hasKey ? '••••demo' : '',
    },
    { provider: 'openai', hasKey: false, maskedKey: '' },
  ],
  connectionTested: fixture.tested,
});
api.saveKey = async () => {
  fixture.calls.push('saveKey');
  fixture.hasKey = true;
  fixture.tested = false;
};
api.removeKey = async () => {
  fixture.calls.push('removeKey');
  fixture.hasKey = false;
  fixture.tested = false;
};
api.openSummaryPage = async (provider, kind) => {
  fixture.calls.push(`open:${provider}:${kind}`);
};
api.saveSummarySettings = async (p) => {
  fixture.calls.push(`save:${p.enabled}`);
  data.settings.liveSummaries = { ...p };
};
api.testSummaryProvider = async () => {
  fixture.calls.push('test');
  fixture.tested = true;
};
api.summarizeNow = async (_id, cardId) => {
  fixture.calls.push(`generate:${cardId ?? 'new'}`);
  state.busy = true;
  await new Promise<void>((resolve) => {
    fixture.settle = resolve;
  });
  const source = {
    id: 'source',
    startSeconds: 12.5,
    endSeconds: 252.25,
    text: 'A correlation does not prove causation. There are two variables. Observational data cannot resolve the causal direction.',
    revision: 0,
  };
  const card = {
    id: 'card',
    lectureId: 'fixture',
    provider: 'groq',
    model: 'openai/gpt-oss-120b',
    language: 'zh',
    sources: [source],
    state: 'completed' as const,
    title: '相关关系与因果推断',
    points: [
      { text: '相关关系不能证明因果关系。', sourceIds: ['source'] },
      { text: '讨论涉及两个变量。', sourceIds: ['source'] },
      { text: '观察数据无法确定因果方向。', sourceIds: ['source'] },
    ],
    message: '',
    createdAt: 0,
  };
  state.cards = [card];
  state.busy = false;
  state.remaining = 0;
  fixture.refresh();
};
function Fixture() {
  const [, tick] = useState(0);
  const [live, setLive] = useState(true);
  fixture.refresh = () => tick((n) => n + 1);
  fixture.live = setLive;
  fixture.stale = () => {
    state.cards[0].state = 'stale';
    state.cards[0].message = '对应原文已更改，请重新整理。';
    fixture.refresh();
  };
  return (
    <WorkspaceProvider
      value={{
        data: structuredClone(data),
        recording: null,
        job: null,
        live: null,
        route: { view: 'courses' },
        navigate: () => {},
        refresh: async () => fixture.refresh(),
        notify: () => {},
      }}
    >
      <main style={{ padding: 24, maxWidth: 720, margin: 'auto' }}>
        <LiveSummarySetup />
        <hr />
        <LiveSummaryPanel
          id="fixture"
          live={live}
          onSeek={(seconds) => {
            fixture.seek = seconds;
          }}
          onAppend={(body) => {
            fixture.notes += body;
            fixture.calls.push('append');
          }}
        />
      </main>
    </WorkspaceProvider>
  );
}
document.documentElement.dataset.theme = 'light';
createRoot(document.getElementById('root')!).render(<Fixture />);
