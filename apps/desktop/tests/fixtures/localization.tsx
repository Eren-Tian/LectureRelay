// Complete React app with synthetic data; no native files, audio, keys or network.
import { createRoot } from 'react-dom/client';
import { mockIPC, mockConvertFileSrc } from '@tauri-apps/api/mocks';
import { App } from '../../src/app/App';
import { messageText } from '../../src/i18n/messages';
import type {
  Bootstrap,
  Lecture,
  LectureDetail,
  LiveStatus,
  ModelStatus,
  InputDevice,
  StudyState,
} from '../../src/types/domain';
import '../../src/styles/app.css';
import '../../src/styles/workspace.css';

const course = {
  id: 'localization-course',
  name: 'Introduction to Biology',
  code: '',
  subject: 'Computer Science',
  description: 'Original course context',
  assistanceLanguage: 'zh' as const,
  createdAt: 0,
  lectureCount: 1,
};
const lecture: Lecture = {
  id: 'localization-lecture',
  courseId: course.id,
  title: 'Cellular respiration',
  startedAt: 1791205200,
  endedAt: 1791205260,
  durationSeconds: 60,
  status: 'completed' as const,
  recordingPath: '',
  transcribedUntil: 45,
  audioSource: 'microphone',
};
const segments = [
  {
    id: 'localization-segment',
    lectureId: lecture.id,
    startSeconds: 0,
    endSeconds: 10,
    sourceText:
      'Mitochondria produce ATP. The rate did not increase by 20 percent.',
    translatedText: '线粒体产生 ATP，速率并未增加 20%。',
    origin: 'local' as const,
    provider: 'nemotron-streaming',
    status: 'final' as const,
    transcriptVersion: 'fixture',
  },
];
const data: Bootstrap = {
  courses: [course],
  recoveredCount: 0,
  recording: null,
  job: null,
  providers: [
    { provider: 'openai', hasKey: false, maskedKey: '' },
    { provider: 'groq', hasKey: false, maskedKey: '' },
  ],
  storage: {
    database: '',
    library: '',
    exports: '',
    state: '',
    version: '中文验证',
  },
  settings: {
    theme: 'light',
    quietMode: true,
    liveSummaries: {
      enabled: false,
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      intervalMinutes: 4,
      uploadConsent: false,
    },
    assistanceLanguage: 'zh',
    provider: 'none',
    chatModel: 'gpt-4o-mini',
    translationMode: 'local',
    translationModel: 'hy-mt2-1.8b',
    studyMode: 'local',
    speechProvider: 'local',
    localModel: 'nemotron-streaming',
    audioSource: 'microphone',
    microphoneDeviceId: '',
    systemDeviceId: '',
    liveTranslation: true,
    englishFontSize: 22,
    translationFontSize: 18,
    showEnglish: true,
    showTranslation: true,
    autoScroll: true,
  },
};
const detail: LectureDetail = {
  course,
  lecture,
  segments,
  answers: [],
  recordingWarning:
    'The audio device reported a discontinuity. Check the recording; the device did not report how much audio was affected.',
  note: {
    body: '# Original manual notes\n\nKeep ATP terminology.',
    origin: 'manual',
    updatedAt: 0,
  },
};
const study: StudyState = {
  sections: [],
  tasks: [
    {
      id: 'task',
      lectureId: lecture.id,
      kind: 'translation',
      language: 'zh',
      state: 'failed',
      completed: 1,
      total: 2,
      message: 'Provider quota or rate limit reached. Try again later.',
      updatedAt: 0,
    },
  ],
  marks: [{ id: 'mark', seconds: 5, label: 'ATP production', kind: 'chapter' }],
  reviews: [],
  versions: [],
  draft: null,
  sourceVersion: 'fixture',
  documents: [],
};
const models: ModelStatus[] = [
  'Nemotron Streaming EN 0.6B',
  'Hy-MT2-1.8B · Q4_K_M',
  'Qwen3.5-4B · Q4_K_M',
].map((name, i) => ({
  name,
  id: ['nemotron-streaming', 'hy-mt2-1.8b', 'qwen3.5-4b'][i],
  installed: true,
  sizeBytes: 1048576,
  downloadedBytes: 1048576,
  downloading: false,
  revision: 'fixture',
  runtimeVersion: 'llama.cpp',
  license: i ? 'Apache 2.0' : 'NVIDIA Open Model License',
  error: i === 1 ? 'Model download cancelled.' : null,
}));
const live: LiveStatus = {
  active: false,
  lectureId: '',
  state: 'listening',
  message: null,
  segments,
  draft: null,
  backlogSeconds: 0,
  translationQueue: 0,
  translation: {
    enabled: true,
    configured: true,
    pendingIds: [],
    deferredIds: [],
    message: null,
  },
};
const fixture = {
  calls: [] as string[],
  messageText,
  data,
  audioSources: [] as string[],
  failSystemDevices: false,
  holdSystemDevices: false,
  finishSystemDevices: (_devices: InputDevice[]) => {},
  previewRequests: 0,
  finishPreview: (_peak: number) => {},
  failCleanup: false,
  failTrash: false,
};
Object.assign(window, { localizationFixture: fixture, isTauri: true });
mockIPC(
  (command, args) => {
    fixture.calls.push(command);
    const input = args as Record<string, unknown>;
    switch (command) {
      case 'bootstrap':
        return structuredClone(data);
      case 'recording_status':
        return data.recording;
      case 'job_status':
        return data.job;
      case 'live_status':
        return structuredClone(live);
      case 'library_search':
        return [{ lecture, courseName: course.name, pinned: false }];
      case 'course_detail':
        return {
          course,
          lectures: [lecture],
          glossary: [
            {
              id: 'term',
              courseId: course.id,
              source: 'ATP',
              translation: 'ATP',
            },
          ],
        };
      case 'lecture_detail':
        return structuredClone(detail);
      case 'study_state':
        return structuredClone(study);
      case 'local_model_status':
        return models[0];
      case 'local_text_models':
        return models.slice(1);
      case 'trash_courses':
        if (fixture.failTrash) throw Error('Cannot read Trash.');
        return [{ ...course, id: 'trash-course', name: 'Archived course' }];
      case 'storage_usage':
        return { libraryBytes: 1048576, modelBytes: 3145728 };
      case 'audio_devices':
        fixture.audioSources.push(String(input.source));
        if (input.source === 'system' && fixture.failSystemDevices)
          throw Error('Cannot open the selected audio device.');
        if (input.source === 'system' && fixture.holdSystemDevices)
          return new Promise<InputDevice[]>((resolve) => {
            fixture.finishSystemDevices = resolve;
          });
        return [
          { id: 'fixture-device', name: 'USB Microphone', isDefault: true },
        ];
      case 'test_audio_input':
        fixture.previewRequests++;
        return new Promise<number>((resolve) => {
          fixture.finishPreview = resolve;
        });
      case 'live_summary_setup':
        return {
          preferences: data.settings.liveSummaries,
          providers: data.providers,
          connectionTested: false,
        };
      case 'free_all_storage':
        if (!fixture.failCleanup)
          throw Error('Fixture forbids deleting any data');
        fixture.failTrash = true;
        throw Error('Cannot finish storage cleanup.');
      case 'save_runtime_preferences':
        Object.assign(data.settings, input);
        return data.settings;
      case 'save_settings':
        Object.assign(data.settings, input.settings);
        return null;
      case 'existing_lecture_ids':
        return [];
      case 'start_lecture': {
        lecture.status = 'recording';
        live.active = true;
        live.lectureId = lecture.id;
        data.recording = {
          source: 'microphone',
          deviceName: 'USB Microphone',
          lectureId: lecture.id,
          paused: false,
          durationSeconds: 60,
          level: 0.1,
          warning:
            'Recording could not keep up: 2 audio buffers (640 samples) were lost. Check the saved recording.',
          failed: false,
          sampleRate: 16000,
          droppedBuffers: 2,
          droppedSamples: 640,
          deviceDiscontinuities: 0,
        };
        return lecture;
      }
      default:
        throw Error('Unexpected native call in localization fixture');
    }
  },
  { shouldMockEvents: true },
);
mockConvertFileSrc('windows');
createRoot(document.getElementById('root')!).render(<App />);
