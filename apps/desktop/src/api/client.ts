import { ui } from '../i18n';
import { messageText } from '../i18n/messages';
import { invoke, isTauri, convertFileSrc } from '@tauri-apps/api/core';
import {
  type Answer,
  type StudyState,
  type LibraryEntry,
  type CourseDocument,
  type ExportKind,
  type AppSettings,
  type Bootstrap,
  type Course,
  type CourseDetail,
  type CourseInput,
  type InputDevice,
  type JobStatus,
  type Lecture,
  type LectureDetail,
  type ProviderStatus,
  type RecordingStatus,
  type SegmentInput,
  type LiveStatus,
  type ModelStatus,
} from '../types/domain';

function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) return Promise.reject(new Error(ui.s000));
  return invoke<T>(command, args);
}

export const api = {
  permanentlyDeleteLecture: (id: string, confirmation: string) =>
    call<void>('permanently_delete_lecture', { id, confirmation }),
  existingLectureIds: (ids: string[]) =>
    call<string[]>('existing_lecture_ids', { ids }),
  study: (id: string) => call<StudyState>('study_state', { id }),
  resumeReview: (id: string, reviewId: string) =>
    call<void>('resume_review', { id, reviewId }),
  permanentlyDeleteCourse: (id: string, confirmation: string) =>
    call<string[]>('permanently_delete_course', { id, confirmation }),
  freeAllStorage: (confirmation: string) =>
    call<string[]>('free_all_storage', { confirmation }),
  saveDraft: (id: string, body: string) =>
    call<void>('save_note_draft', { id, body }),
  clearDraft: (id: string) => call<void>('clear_note_draft', { id }),
  saveMark: (
    id: string,
    seconds: number,
    label: string,
    kind: 'bookmark' | 'chapter',
  ) => call<void>('save_study_mark', { id, seconds, label, kind }),
  deleteMark: (lectureId: string, id: string) =>
    call<void>('delete_study_mark', { lectureId, id }),
  library: (query: string) => call<LibraryEntry[]>('library_search', { query }),
  pin: (id: string, pinned: boolean) =>
    call<void>('pin_lecture', { id, pinned }),
  importMedia: (courseId: string, title: string) =>
    call<Lecture | null>('import_media', { courseId, title }),
  attachDocument: (courseId: string) =>
    call<CourseDocument | null>('attach_document', { courseId }),
  readDocument: (courseId: string, id: string) =>
    call<ArrayBuffer>('read_document', { courseId, id }),
  bootstrap: () => call<Bootstrap>('bootstrap'),
  storageUsage: () =>
    call<{ libraryBytes: number; modelBytes: number }>('storage_usage'),
  course: (id: string) => call<CourseDetail>('course_detail', { id }),
  saveCourse: (id: string | null, input: CourseInput) =>
    call<Course>('save_course', { id, input }),
  deleteCourse: (id: string) => call<void>('delete_course', { id }),
  saveTerm: (
    courseId: string,
    id: string | null,
    source: string,
    translation: string,
  ) => call<void>('save_term', { courseId, id, source, translation }),
  deleteTerm: (courseId: string, id: string) =>
    call<void>('delete_term', { courseId, id }),
  inputDevices: () => call<InputDevice[]>('input_devices'),
  testAudioInput: (id: string, source: string, deviceId: string) =>
    call<number>('test_audio_input', { id, source, deviceId }),
  audioDevices: (source: string) =>
    call<InputDevice[]>('audio_devices', { source }),
  live: () => call<LiveStatus>('live_status'),
  localModel: () => call<ModelStatus>('local_model_status'),
  textModels: () => call<ModelStatus[]>('local_text_models'),
  downloadTextModel: (id: string) => call<void>('download_text_model', { id }),
  removeTextModel: (id: string) => call<void>('remove_text_model', { id }),
  downloadModel: () => call<void>('download_local_model'),
  removeModel: () => call<void>('remove_local_model'),
  cancelModel: () => call<void>('cancel_model_download'),
  trash: () => call<Course[]>('trash_courses'),
  restoreCourse: (id: string) => call<void>('restore_course', { id }),
  startLecture: (
    courseId: string,
    title: string,
    deviceId: string,
    source: string,
  ) => call<Lecture>('start_lecture', { courseId, title, deviceId, source }),
  pauseLecture: (id: string, paused: boolean) =>
    call<void>('pause_lecture', { id, paused }),
  stopLecture: (id: string) => call<Lecture>('stop_lecture', { id }),
  recording: () => call<RecordingStatus | null>('recording_status'),
  lecture: (id: string) => call<LectureDetail>('lecture_detail', { id }),
  saveSegment: (lectureId: string, id: string | null, input: SegmentInput) =>
    call<void>('save_segment', { lectureId, id, input }),
  saveNote: (lectureId: string, body: string) =>
    call<void>('save_note', { lectureId, body }),
  saveSettings: (settings: AppSettings) =>
    call<void>('save_settings', { settings }),
  saveRuntimePreferences: (
    preferences: Partial<Pick<AppSettings, 'theme' | 'quietMode'>>,
  ) => call<AppSettings>('save_runtime_preferences', preferences),
  saveKey: (provider: string, key: string) =>
    call<void>('save_provider_key', { provider, key }),
  removeKey: (provider: string) =>
    call<void>('remove_provider_key', { provider }),
  providerStatus: (provider: string) =>
    call<ProviderStatus>('provider_status', { provider }),
  testProvider: (provider: string, model: string) =>
    call<void>('test_provider', { provider, model }),
  transcribe: (id: string, translate: boolean) =>
    call<void>('transcribe_lecture', { id, translate }),
  translate: (id: string) => call<void>('translate_lecture', { id }),
  generateNotes: (id: string) => call<void>('generate_notes', { id }),
  generateReview: (id: string, request: string) =>
    call<void>('generate_review', { id, request }),
  ask: (id: string, question: string) =>
    call<Answer>('ask_lecture', { id, question }),
  job: () => call<JobStatus | null>('job_status'),
  openCaptions: () => call<void>('open_caption_window'),
  pauseLiveTranslation: (paused: boolean) =>
    call<void>('pause_live_translation', { paused }),
  closeCaptions: () => call<void>('close_caption_window'),
  captionState: () =>
    call<{
      live: LiveStatus;
      settings: AppSettings;
      recording: RecordingStatus | null;
    }>('caption_state'),
  print: () => call<void>('print_document'),
  cancelLive: () => call<void>('cancel_live_processing'),
  cancelJob: () => call<void>('cancel_job'),
  export: (id: string, kind: ExportKind) =>
    call<string>('export_lecture', { id, kind }),
  openFolder: (kind: 'library' | 'exports' | 'state') =>
    call<void>('open_data_folder', { kind }),
  quit: () => call<void>('quit_app'),
};

/** Clear browser fallback drafts only after the database confirms their lecture was deleted. */
export async function pruneDeletedDrafts() {
  const prefix = 'lecturerelay-note-draft:';
  const ids = Object.keys(localStorage)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));
  for (let offset = 0; offset < ids.length; offset += 250) {
    const batch = ids.slice(offset, offset + 250);
    const existing = new Set(await api.existingLectureIds(batch));
    for (const id of batch)
      if (!existing.has(id)) localStorage.removeItem(prefix + id);
  }
}

export const recordingUrl = (path: string) => convertFileSrc(path);
export const errorText = (error: unknown) =>
  messageText(
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : ui.s001,
  );
