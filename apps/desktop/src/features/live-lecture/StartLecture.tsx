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
    ui.s199(
      new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
      course.code || 'Lecture',
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
    <Modal title={ui.s200} onClose={close}>
      <p className="modal-copy">{course.name}</p>
      <form className="form-stack" onSubmit={start}>
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
          {ui.s201}
          <input
            required
            maxLength={150}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          {ui.s202}
          <select
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
            disabled={!devices?.length || busy || testing}
          >
            {devices === null ? (
              <option>{ui.s203}</option>
            ) : !devices.length ? (
              <option>{ui.s204}</option>
            ) : (
              devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                  {device.isDefault ? ui.s205 : ''}
                </option>
              ))
            )}
          </select>
        </label>
        {devices?.length === 0 && (
          <div className="notice warning">
            <p>{deviceError || ui.s206}</p>
            <button
              type="button"
              className="text-button"
              onClick={() => void checkDevices()}
            >
              {ui.s207}
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
            <strong>{ui.s208}</strong>
            <p>{ui.livePrivacy}</p>
          </div>
        </div>
        <p className="field-hint">
          {source === 'system' ? ui.sourceHint : ui.s210}
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={close}
          >
            {ui.s211}
          </button>
          <button
            className="button primary"
            disabled={busy || testing || !devices?.length}
          >
            <Icon name="mic" />
            {busy ? ui.s212 : ui.s213}
          </button>
        </div>
      </form>
    </Modal>
  );
}
