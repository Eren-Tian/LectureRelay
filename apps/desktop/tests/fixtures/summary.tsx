// Component/state fixtures only; real audio and model checks use MIT OCW.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkspaceProvider } from '../../src/app/Workspace';
import { StudyTools } from '../../src/features/study/StudyTools';
import { api } from '../../src/api/client';
import { defaultSummaryPreferences } from '../../src/features/study/LiveSummarySetup';
import type {
  Bootstrap,
  LectureDetail,
  StudyState,
  LiveStatus,
} from '../../src/types/domain';
import '../../src/styles/app.css';

const study: StudyState = {
  sections: Array.from({ length: 17 }, (_, n) => ({
    startSeconds: n * 120 + 0.125,
    endSeconds: n * 120 + 119.875,
    source: `Evidence ${n + 1}: no fabricated claims.`,
    translation: `第 ${n + 1} 段中文原文。`,
  })),
  reviews: [],
  tasks: [],
  marks: [],
  versions: [],
  draft: null,
  sourceVersion: 'v1',
  documents: [],
};
const detail = {
  lecture: {
    id: 'summary-fixture',
    durationSeconds: 2040,
    status: 'completed',
    transcribedUntil: 2040,
  },
  course: { id: 'fixture-course', assistanceLanguage: 'zh' },
  note: { body: 'Original manual note', origin: 'manual', updatedAt: 0 },
  segments: [],
  answers: [],
} as unknown as LectureDetail;
const data = {
  settings: {
    studyMode: 'local',
    theme: 'light',
    liveSummaries: defaultSummaryPreferences,
  },
  courses: [],
  providers: [],
  storage: {},
  recording: null,
  job: null,
  recoveredCount: 0,
} as unknown as Bootstrap;
const fixture = {
  calls: [] as string[],
  seek: -1,
  draft: '',
  live: (_on: boolean) => {},
  stale: () => {},
  settle: () => {},
};
Object.assign(window, { summaryFixture: fixture });
api.study = async () => structuredClone(study);
api.summaryState = async () => ({
  cards: [],
  busy: false,
  message: '',
  remaining: 0,
  collectingSeconds: 0,
});
api.saveDraft = async (_id, body) => {
  fixture.draft = body;
};
api.generateNotes = async () => {
  fixture.calls.push('generateNotes');
  await new Promise<void>((resolve) => {
    fixture.settle = resolve;
  });
  study.reviews = [
    {
      id: 'summary-run',
      request: '',
      state: 'paused',
      message: '',
      sourceVersion: 'v1',
      language: 'zh',
      origin: 'local',
      parts: study.sections.slice(0, 3).map((s, n) => ({
        ...s,
        depth: 0,
        body: n < 2 ? `- Saved key point ${n + 1}` : null,
      })),
      levels: [],
      recoveries: 0,
      publishedVersion: null,
    },
  ];
};
api.resumeReview = async () => {
  fixture.calls.push('resumeReview');
  study.reviews[0].parts[2].body = '- Saved key point 3';
  study.reviews[0].publishedVersion = 'version';
  study.reviews[0].state = 'completed';
};
function Fixture() {
  const [live, setLive] = useState(false),
    [tick, setTick] = useState(0);
  fixture.live = setLive;
  fixture.stale = () => {
    study.sourceVersion = 'v2';
    setTick((n) => n + 1);
  };
  return (
    <WorkspaceProvider
      value={{
        data,
        recording: null,
        job: null,
        live: live
          ? ({ lectureId: detail.lecture.id, active: true } as LiveStatus)
          : null,
        route: { view: 'courses' },
        navigate: () => {},
        refresh: async () => {},
        notify: () => {},
      }}
    >
      <main style={{ padding: 24, maxWidth: 640, margin: 'auto' }}>
        <StudyTools
          detail={{ ...detail, note: { ...detail.note!, updatedAt: tick } }}
          position={0}
          onSeek={(seconds) => {
            fixture.seek = seconds;
          }}
          onReload={async () => {}}
          onAI={() => {}}
        />
      </main>
    </WorkspaceProvider>
  );
}
localStorage.removeItem('lecturerelay-note-draft:summary-fixture');
document.documentElement.dataset.theme = 'light';
createRoot(document.getElementById('root')!).render(<Fixture />);
