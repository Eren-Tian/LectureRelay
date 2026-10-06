import { ui } from '../i18n';
import { useCallback, useEffect, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { api, errorText, pruneDeletedDrafts } from '../api/client';
import {
  type Bootstrap,
  type JobStatus,
  type RecordingStatus,
  type LiveStatus,
} from '../types/domain';
import { type Route } from './routes';
import { Icon } from '../components/Icon';
import { CoursesPage } from '../features/courses/CoursesPage';
import { CoursePage } from '../features/courses/CoursePage';
import { CourseForm } from '../features/courses/CourseForm';
import { LivePage } from '../features/live-lecture/LivePage';
import { LecturePage } from '../features/lecture-history/LectureWorkspace';
import { SettingsPage } from '../features/settings/SettingsPage';
import { WorkspaceProvider, useWorkspace } from './Workspace';
import { nextLiveStatus } from '../lib/live-status';

function CloseGuard() {
  const { confirm, notify, refresh } = useWorkspace();
  useEffect(() => {
    const subscription = listen<string>(
      'close-during-recording',
      async (event) => {
        if (
          !(await confirm({
            title: ui.s006,
            body: ui.s007,
            action: ui.s008,
          }))
        )
          return;
        try {
          const recording = await api.recording();
          if (recording && recording.lectureId !== event.payload) {
            notify('当前录音已切换，已取消退出。');
            return;
          }
          if (recording) await api.stopLecture(recording.lectureId);
          await api.quit();
        } catch (error) {
          notify(errorText(error), true);
          await refresh();
        }
      },
    );
    return () => {
      void subscription.then((unsubscribe) => unsubscribe());
    };
  }, [confirm, notify, refresh]);
  return null;
}

export function App() {
  const [data, setData] = useState<Bootstrap>();
  const [route, setRoute] = useState<Route>({ view: 'courses' });
  const [recording, setRecording] = useState<RecordingStatus | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [live, setLive] = useState<LiveStatus | null>(null);
  const [error, setError] = useState('');
  const [create, setCreate] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('lecturerelay-sidebar') === 'collapsed';
    } catch {
      return false;
    }
  });
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  const refresh = useCallback(async () => {
    const value = await api.bootstrap();
    setData(value);
    setRecording(value.recording);
    setJob(value.job);
    setError('');
  }, []);
  useEffect(() => {
    if (!data) return;
    document.documentElement.dataset.theme = data.settings.theme;
    try {
      localStorage.setItem('lecturerelay-theme', data.settings.theme);
    } catch {
      /* Preferences remain in SQLite. */
    }
  }, [data?.settings.theme]);
  useEffect(() => {
    if (isTauri())
      void refresh()
        .then(() => pruneDeletedDrafts().catch(() => {}))
        .catch((error) => setError(errorText(error)));
  }, [refresh]);
  useEffect(() => {
    if (!isTauri()) return;
    const subscription = listen<RecordingStatus>('recording-status', (event) =>
      setRecording(event.payload),
    );
    const liveSubscription = listen<LiveStatus>('live-status', (event) =>
      setLive((current) => nextLiveStatus(current, event.payload)),
    );
    const readLive = () =>
      void api
        .live()
        .then((value) => setLive((current) => nextLiveStatus(current, value)))
        .catch(() => {});
    readLive();
    const interval = setInterval(() => {
      readLive();
      if (recording) return;
      void api
        .job()
        .then(setJob)
        .catch(() => {});
    }, 2000);
    return () => {
      clearInterval(interval);
      void subscription.then((unsubscribe) => unsubscribe());
      void liveSubscription.then((unsubscribe) => unsubscribe());
    };
  }, [recording?.lectureId]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);
  const closeCreate = useCallback(() => setCreate(false), []);
  if (!isTauri())
    return (
      <div className="desktop-only">
        <h1>LectureRelay</h1>
        <h2>{ui.s010}</h2>
        <p>{ui.s011}</p>
        <p className="field-hint">
          {ui.s012}
          <code>pnpm dev</code>
          {ui.s013}
        </p>
      </div>
    );
  if (!data)
    return (
      <div className="startup">
        <h1>LectureRelay</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button
              className="button secondary"
              onClick={() =>
                void refresh().catch((error) => setError(errorText(error)))
              }
            >
              {ui.s014}
            </button>
          </>
        ) : (
          <>
            <div className="spinner" />
            <p>{ui.s015}</p>
          </>
        )}
      </div>
    );
  return (
    <WorkspaceProvider
      value={{
        data,
        route,
        recording,
        job,
        live,
        navigate: setRoute,
        refresh,
        notify,
      }}
    >
      <CloseGuard />
      <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className="sidebar">
          <button
            className="brand"
            onClick={() => setRoute({ view: 'courses' })}
          >
            <img src="/app-icon.svg" alt="" />
            <span>
              <strong>LectureRelay</strong>
            </span>
          </button>
          <button
            className="sidebar-toggle"
            aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
            aria-expanded={!collapsed}
            onClick={() => {
              setCollapsed(!collapsed);
              try {
                localStorage.setItem(
                  'lecturerelay-sidebar',
                  !collapsed ? 'collapsed' : 'expanded',
                );
              } catch {}
            }}
          >
            {collapsed ? '›' : '‹'}
          </button>
          <nav>
            <button
              className={route.view !== 'settings' ? 'selected' : ''}
              onClick={() => setRoute({ view: 'courses' })}
            >
              <Icon name="books" />
              <span>{ui.s017}</span>
            </button>
            <button
              className={route.view === 'settings' ? 'selected' : ''}
              onClick={() => setRoute({ view: 'settings' })}
            >
              <Icon name="settings" />
              <span>{ui.s018}</span>
            </button>
          </nav>
          <div className="sidebar-courses" aria-label="课程">
            {data.courses.map((course) => (
              <button
                key={course.id}
                className={
                  route.view === 'course' && route.id === course.id
                    ? 'active'
                    : ''
                }
                title={course.name}
                aria-label={course.name}
                onClick={() => setRoute({ view: 'course', id: course.id })}
              >
                <span className="course-initial">
                  {(course.code || course.name).slice(0, 2)}
                </span>
                <span className="sidebar-course-name">{course.name}</span>
              </button>
            ))}
          </div>
          {recording && (
            <button
              className="sidebar-recording"
              onClick={() =>
                setRoute({ view: 'live', id: recording.lectureId })
              }
            >
              <span
                className={`record-dot ${recording.paused || recording.failed ? 'inactive' : ''}`}
              />
              <span>
                {recording.failed
                  ? ui.s019
                  : recording.paused
                    ? ui.s020
                    : ui.s021}
                <small>{ui.s022}</small>
              </span>
              <Icon name="arrow" size={16} />
            </button>
          )}
          {job && (
            <button
              className="sidebar-job"
              onClick={() =>
                setRoute(
                  job.kind === 'provider-test'
                    ? { view: 'settings', entry: 'services' }
                    : { view: 'lecture', id: job.lectureId },
                )
              }
            >
              <Icon name="spark" size={17} />
              <span>
                {job.kind === 'provider-test' ? ui.s023 : ui.s024}
                <small>
                  {job.total ? `${job.completed} / ${job.total}` : ui.s025}
                </small>
              </span>
            </button>
          )}
          {!recording && live?.active && (
            <button
              className="sidebar-job"
              onClick={() => setRoute({ view: 'lecture', id: live.lectureId })}
            >
              <Icon name="spark" size={17} />
              <span>
                {ui.recordingSaved}
                <small>{ui.remainingProcessing}</small>
              </span>
            </button>
          )}
          <div className="sidebar-bottom">
            <div>
              <span className="sidebar-version">v{data.storage.version}</span>
            </div>
          </div>
        </aside>
        <main
          className={`main-content ${route.view === 'live' ? 'live-workspace' : route.view === 'lecture' ? 'replay-workspace' : ''}`}
        >
          {data.recoveredCount > 0 && (
            <div className="recovery-banner">
              <Icon name="shield" size={17} />
              {ui.s029}
              {data.recoveredCount} {ui.s030}
            </div>
          )}
          {route.view === 'courses' && (
            <CoursesPage onCreate={() => setCreate(true)} />
          )}
          {route.view === 'course' && (
            <CoursePage key={route.id} id={route.id} />
          )}
          {route.view === 'live' && <LivePage key={route.id} id={route.id} />}
          {route.view === 'lecture' && (
            <LecturePage key={route.id} id={route.id} />
          )}
          {route.view === 'settings' && (
            <SettingsPage key="settings" initialEntry={route.entry} />
          )}
        </main>
      </div>
      {create && <CourseForm onClose={closeCreate} />}
      {toast && (
        <div
          className={`toast ${toast.error ? 'error' : ''}`}
          role={toast.error ? 'alert' : 'status'}
        >
          <Icon name={toast.error ? 'shield' : 'check'} size={19} />
          <span>{toast.message}</span>
          <button
            className="icon-button"
            aria-label={ui.s031}
            onClick={() => setToast(null)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </WorkspaceProvider>
  );
}
