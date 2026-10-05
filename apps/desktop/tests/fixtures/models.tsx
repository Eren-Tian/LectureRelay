// Real Settings UI with controlled IPC: no credentials, model downloads or user data.
import { createRoot } from 'react-dom/client';
import { mockIPC } from '@tauri-apps/api/mocks';
import { emit } from '@tauri-apps/api/event';
import { api } from '../../src/api/client';
import { WorkspaceProvider } from '../../src/app/Workspace';
import { SettingsPage } from '../../src/features/settings/SettingsPage';
import { DeleteLecture } from '../../src/features/lecture-history/DeleteLecture';
import type {
  Bootstrap,
  ModelStatus,
  RecordingStatus,
} from '../../src/types/domain';
import '../../src/styles/app.css';

const mode = new URLSearchParams(location.search).get('mode');
mockIPC(
  () => {
    throw Error('Unexpected native call in model fixture');
  },
  { shouldMockEvents: true },
);
const models: ModelStatus[] = [
  'nemotron-streaming',
  'hy-mt2-1.8b',
  'qwen3.5-4b',
].map((id) => ({
  id,
  name: id,
  sizeBytes: 1024,
  installed: false,
  downloadedBytes: 0,
  downloading: false,
  revision: 'fixture',
  runtimeVersion: 'fixture',
  license: 'fixture',
  error: null,
}));
if (mode === 'setup')
  for (const model of models.slice(0, 2)) model.installed = true;
let reads = 0;
let failRefresh = false;
const fixture = {
  calls: [] as string[],
  fail: (_message: string) => {},
  complete: async () => {},
  notifications: [] as string[],
  saved: null as Bootstrap['settings'] | null,
};
Object.assign(window, { modelFixture: fixture });
api.localModel = async () => {
  if (failRefresh) throw Error('Model status refresh unavailable');
  if (mode === 'model-retry' && reads++ === 0)
    throw Error('Model status read failed');
  return { ...models[0] };
};
api.textModels = async () => models.slice(1).map((model) => ({ ...model }));
api.trash = async () => {
  if (mode === 'trash-failure') throw Error('Trash read failed');
  return [];
};
const download = async (id: string) => {
  fixture.calls.push(id);
  await emit('model-status', {
    ...models.find((model) => model.id === id),
    downloading: true,
  });
  return new Promise<void>((resolve, reject) => {
    fixture.fail = reject;
    fixture.complete = async () => {
      const model = models.find((model) => model.id === id)!;
      model.installed = true;
      model.downloadedBytes = model.sizeBytes;
      failRefresh = true;
      await emit('model-status', { ...model });
      resolve();
    };
  });
};
api.downloadModel = () => download('nemotron-streaming');
api.downloadTextModel = (id) => download(id);
api.cancelModel = async () => {
  fixture.fail('Model download cancelled.');
};
api.saveSettings = async (settings) => {
  fixture.saved = settings;
};
api.permanentlyDeleteLecture = async (id, confirmation) => {
  fixture.calls.push(`delete:${id}:${confirmation}`);
};
api.existingLectureIds = async () => [];
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
const recording =
  mode === 'recording' ? ({ lectureId: 'fixture' } as RecordingStatus) : null;
createRoot(document.getElementById('root')!).render(
  <WorkspaceProvider
    value={{
      data,
      recording,
      job: null,
      live: null,
      route: { view: 'settings' },
      navigate: () => {},
      refresh: async () => {},
      notify: (message) => {
        fixture.notifications.push(message);
      },
    }}
  >
    <main>
      {mode === 'delete' ? (
        <DeleteLecture
          lecture={{
            id: 'fixture-lecture',
            courseId: 'fixture-course',
            title: 'Disposable lecture',
            startedAt: 0,
            endedAt: 10,
            durationSeconds: 10,
            status: 'completed',
            recordingPath: '',
            transcribedUntil: 0,
            audioSource: 'microphone',
          }}
        />
      ) : (
        <SettingsPage />
      )}
    </main>
  </WorkspaceProvider>,
);
