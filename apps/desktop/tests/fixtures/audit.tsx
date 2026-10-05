// Controlled promises exercise real React components; no native IPC or provider requests.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkspaceProvider } from '../../src/app/Workspace';
import { StudyNotes } from '../../src/features/study/StudyNotes';
import { useAction } from '../../src/hooks/useAction';
import { api } from '../../src/api/client';
import type { Bootstrap, Note, StudyState } from '../../src/types/domain';
import '../../src/styles/app.css';

const fixture = {
  calls: [] as string[],
  note: 'Initial manual note',
  settle: (_fail = false) => {},
};
Object.assign(window, { auditFixture: fixture });
const deferred = (kind: string) => {
  fixture.calls.push(kind);
  return new Promise<void>((resolve, reject) => {
    fixture.settle = (fail = false) =>
      fail ? reject('Controlled save failure') : resolve();
  });
};
api.saveNote = async (_id, body) => {
  await deferred('saveNote');
  fixture.note = body;
};
api.saveDraft = async () => {
  fixture.calls.push('saveDraft');
};
api.clearDraft = async () => deferred('clearDraft');
const data: Bootstrap = {
  courses: [],
  recording: null,
  job: null,
  providers: [],
  recoveredCount: 0,
  storage: {
    database: '',
    library: '',
    exports: '',
    state: '',
    version: 'fixture',
  },
  settings: {
    theme: 'light',
    quietMode: true,
    assistanceLanguage: 'zh',
    provider: 'none',
    chatModel: '',
    translationMode: 'none',
    translationModel: 'hy-mt2-1.8b',
    studyMode: 'none',
    speechProvider: 'none',
    localModel: '',
    audioSource: 'system',
    microphoneDeviceId: '',
    systemDeviceId: '',
    liveTranslation: false,
    englishFontSize: 22,
    translationFontSize: 18,
    showEnglish: true,
    showTranslation: true,
    autoScroll: true,
  },
};
const study: StudyState = {
  sections: [],
  reviews: [],
  tasks: [],
  marks: [],
  versions: [],
  draft: null,
  sourceVersion: 'fixture',
  documents: [],
};

function Actions() {
  const { busy, run } = useAction();
  return (
    <button
      id="double-action"
      disabled={busy}
      onClick={() => {
        void run(() => deferred('action'));
        void run(() => deferred('action'));
      }}
    >
      Attempt two simultaneous actions
    </button>
  );
}
function Fixture() {
  const [note, setNote] = useState<Note>({
    body: fixture.note,
    updatedAt: 0,
    origin: 'manual',
  });
  return (
    <WorkspaceProvider
      value={{
        data,
        recording: null,
        job: null,
        live: null,
        route: { view: 'courses' },
        navigate: () => {},
        refresh: async () => {},
        notify: () => {},
      }}
    >
      <main style={{ padding: 24 }}>
        <p>Isolated component fixture · synthetic content</p>
        <Actions />
        <StudyNotes
          id="audit-fixture"
          note={note}
          study={study}
          position={12}
          blocked={false}
          onSaved={async () => {
            setNote({ body: fixture.note, updatedAt: 0, origin: 'manual' });
          }}
        />
      </main>
    </WorkspaceProvider>
  );
}
localStorage.removeItem('lecturerelay-note-draft:audit-fixture');
createRoot(document.getElementById('root')!).render(<Fixture />);
