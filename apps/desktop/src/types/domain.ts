export type AssistanceLanguage = 'zh' | 'ja' | 'ko';
export type ProviderName = 'none' | 'openai' | 'groq';

export interface Course {
  id: string;
  name: string;
  code: string;
  subject: string;
  description: string;
  assistanceLanguage: AssistanceLanguage;
  createdAt: number;
  lectureCount: number;
}
export type CourseInput = Pick<
  Course,
  'name' | 'code' | 'subject' | 'description' | 'assistanceLanguage'
>;

export interface Lecture {
  id: string;
  courseId: string;
  title: string;
  startedAt: number;
  endedAt: number | null;
  durationSeconds: number;
  status: 'recording' | 'completed' | 'interrupted' | 'failed';
  recordingPath: string;
  transcribedUntil: number;
}
export interface TranscriptSegment {
  id: string;
  lectureId: string;
  startSeconds: number;
  endSeconds: number;
  sourceText: string;
  translatedText: string;
  origin: 'manual' | 'cloud';
  provider: string;
  status: 'partial' | 'final';
  transcriptVersion: string;
}
export type SegmentInput = Pick<
  TranscriptSegment,
  'startSeconds' | 'endSeconds' | 'sourceText' | 'translatedText'
>;
export interface GlossaryTerm {
  id: string;
  courseId: string;
  source: string;
  translation: string;
}
export interface Note {
  body: string;
  updatedAt: number;
  origin: 'manual' | 'cloud';
}
export interface Answer {
  id: string;
  question: string;
  answer: string;
  sources: TranscriptSegment[];
  createdAt: number;
}
export interface CourseDetail {
  course: Course;
  lectures: Lecture[];
  glossary: GlossaryTerm[];
}
export interface LectureDetail {
  lecture: Lecture;
  course: Course;
  segments: TranscriptSegment[];
  note: Note | null;
  answers: Answer[];
}
export interface AppSettings {
  theme: 'light' | 'dark';
  quietMode: boolean;
  assistanceLanguage: AssistanceLanguage;
  provider: ProviderName;
  chatModel: string;
  speechProvider: 'none' | 'local' | 'openai' | 'groq';
  localModel: string;
  audioSource: 'microphone' | 'system';
  microphoneDeviceId: string;
  systemDeviceId: string;
  liveTranslation: boolean;
  englishFontSize: number;
  translationFontSize: number;
  showEnglish: boolean;
  showTranslation: boolean;
  autoScroll: boolean;
}
export interface ProviderStatus {
  provider: ProviderName;
  hasKey: boolean;
  maskedKey: string;
}
export interface RecordingStatus {
  source: string;
  deviceName: string;
  lectureId: string;
  paused: boolean;
  durationSeconds: number;
  level: number;
  warning: string | null;
  failed: boolean;
}
export interface JobStatus {
  lectureId: string;
  kind:
    'transcription' | 'translation' | 'notes' | 'question' | 'provider-test';
  completed: number;
  total: number;
  cancelling: boolean;
}
export interface InputDevice {
  id: string;
  name: string;
  isDefault: boolean;
}
export interface LiveStatus {
  active: boolean;
  lectureId: string;
  state: string;
  message: string | null;
  segments: TranscriptSegment[];
  draft: {
    id: string;
    startSeconds: number;
    endSeconds: number;
    partialText: string;
    status: 'partial';
  } | null;
  backlogSeconds: number;
  translationQueue: number;
  translation: {
    enabled: boolean;
    configured: boolean;
    pendingIds: string[];
    deferredIds: string[];
    message: string | null;
  };
}
export interface ModelStatus {
  id: string;
  name: string;
  sizeBytes: number;
  installed: boolean;
  downloadedBytes: number;
  downloading: boolean;
  revision: string;
  runtimeVersion: string;
  license: string;
  error: string | null;
}
export interface StorageInfo {
  database: string;
  library: string;
  exports: string;
  state: string;
  version: string;
}
export interface Bootstrap {
  courses: Course[];
  settings: AppSettings;
  storage: StorageInfo;
  providers: ProviderStatus[];
  recording: RecordingStatus | null;
  job: JobStatus | null;
  recoveredCount: number;
}

export interface ProcessingTask {
  id: string;
  lectureId: string;
  kind: string;
  language: string;
  state: 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  completed: number;
  total: number;
  message: string;
  updatedAt: number;
}
export interface StudyMark {
  id: string;
  seconds: number;
  label: string;
  kind: 'bookmark' | 'chapter';
}
export interface NoteVersion {
  id: string;
  body: string;
  origin: string;
  language: string;
  sourceVersion: string;
  createdAt: number;
}
export interface CourseDocument {
  id: string;
  name: string;
  path: string;
}
export interface StudyState {
  tasks: ProcessingTask[];
  marks: StudyMark[];
  versions: NoteVersion[];
  draft: string | null;
  sourceVersion: string;
  documents: CourseDocument[];
}
export interface LibraryEntry {
  lecture: Lecture;
  courseName: string;
  pinned: boolean;
}
export type ExportKind =
  | 'notes'
  | 'transcript-json'
  | 'transcript-markdown'
  | 'srt-source'
  | 'srt-translation'
  | 'srt-bilingual'
  | 'vtt-source'
  | 'vtt-translation'
  | 'vtt-bilingual';
