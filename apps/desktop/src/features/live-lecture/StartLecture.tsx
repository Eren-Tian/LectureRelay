import { ui } from '../../i18n';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorText } from '../../api/client';
import { type Course, type InputDevice } from '../../types/domain';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icon';
import { useAction } from '../../hooks/useAction';
import { useWorkspace } from '../../app/Workspace';
import { AudioInputTest } from '../settings/AudioInputTest';

export function StartLecture({
  course,
  onClose,
}: {
  course: Course;
  onClose: () => void;
}) {
  const { refresh, navigate, data } = useWorkspace();
  const [source, setSource] = useState(data.settings.audioSource);
  const [title, setTitle] = useState(
    ui.defaultLectureTitle(
      new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }),
      course.code || ui.untitledLectureName,
    ),
  );
  const [devices, setDevices] = useState<InputDevice[] | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [deviceError, setDeviceError] = useState('');
  const [testing, setTesting] = useState(false);
  const preferredDevice =
    source === 'microphone'
      ? data.settings.microphoneDeviceId
      : data.settings.systemDeviceId;
  const { busy, run } = useAction();
  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);
  const checkDevices = useCallback(async () => {
    setDevices(null);
    setDeviceError('');
    try {
      const items = await api.audioDevices(source);
      setDevices(items);
      setDeviceId(
        items.find((device) => device.id === preferredDevice)?.id ??
          items.find((device) => device.isDefault)?.id ??
          items[0]?.id ??
          '',
      );
    } catch (error) {
      setDevices([]);
      setDeviceError(errorText(error));
    }
  }, [source, preferredDevice]);
  useEffect(() => {
    void checkDevices();
  }, [checkDevices]);
  const start = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const lecture = await api.startLecture(
        course.id,
        title,
        deviceId,
        source,
      );
      await refresh();
      onClose();
      navigate({ view: 'live', id: lecture.id });
    });
  };
  return (
    <Modal title={ui.startLecture} onClose={close}>
      <p className="modal-copy">{course.name}</p>
      <form className="form-stack" onSubmit={start}>
        <div className="notice">
          <div>
            <strong>
              {data.settings.speechProvider === 'none'
                ? ui.startNoticeAudioOnly
                : ui.startNoticeCaptions}
            </strong>
            <p>
              {data.settings.speechProvider === 'none'
                ? ui.startNoticeCaptionsOff
                : `${data.settings.speechProvider === 'local' ? ui.localEnglishRecognition : ui.cloudEnglishRecognition} · ${data.settings.liveTranslation && data.settings.translationMode !== 'none' ? ui.translationOn : ui.translationOff} · ${data.settings.quietMode ? ui.quietMode : ui.fullSpeedMode}`}
            </p>
            {data.settings.speechProvider === 'none' && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  onClose();
                  navigate({ view: 'settings', entry: 'setup' });
                }}
              >
                {ui.setUpCaptions}
              </button>
            )}
          </div>
        </div>
        <label>
          {ui.audioSource}
          <select
            value={source}
            disabled={busy || testing}
            onChange={(e) =>
              setSource(e.target.value as 'microphone' | 'system')
            }
          >
            <option value="microphone">{ui.microphone}</option>
            <option value="system">{ui.systemAudio}</option>
          </select>
        </label>
        <label>
          {ui.lectureTitle}
          <input
            required
            maxLength={150}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          {ui.audioDevice}
          <select
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
            disabled={!devices?.length || busy || testing}
          >
            {devices === null ? (
              <option>{ui.checkingAudioDevices}</option>
            ) : !devices.length ? (
              <option>{ui.noAudioDevices}</option>
            ) : (
              devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                  {device.isDefault ? ui.defaultDeviceSuffix : ''}
                </option>
              ))
            )}
          </select>
        </label>
        {devices?.length === 0 && (
          <div className="notice warning">
            <p>{deviceError || ui.microphoneAccessHint}</p>
            <button
              type="button"
              className="text-button"
              onClick={() => void checkDevices()}
            >
              {ui.checkAgain}
            </button>
          </div>
        )}
        <AudioInputTest
          source={source}
          deviceId={deviceId}
          disabled={busy || !devices?.length}
          onTesting={setTesting}
        />
        <div className="notice">
          <Icon name="shield" />
          <div>
            <strong>{ui.recordingStaysLocal}</strong>
            <p>{ui.livePrivacy}</p>
          </div>
        </div>
        <p className="field-hint">
          {source === 'system'
            ? ui.sourceHint
            : ui.chooseSpeechRecognitionBeforeClass}
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={close}
          >
            {ui.cancel}
          </button>
          <button
            className="button primary"
            disabled={busy || testing || !devices?.length}
          >
            <Icon name="mic" />
            {busy ? ui.startingRecording : ui.startRecording}
          </button>
        </div>
      </form>
    </Modal>
  );
}
