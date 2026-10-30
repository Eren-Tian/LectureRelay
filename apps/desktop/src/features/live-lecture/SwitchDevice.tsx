import { useEffect, useState } from 'react';
import { ui } from '../../i18n';
import { api, errorText } from '../../api/client';
import { Modal } from '../../components/Modal';
import { useAction } from '../../hooks/useAction';
import type { InputDevice, RecordingStatus } from '../../types/domain';

/** Moves a running recording to another device of the same kind. */
export function SwitchDevice({
  lectureId,
  recording,
  onSwitching,
  onClose,
}: {
  lectureId: string;
  recording: RecordingStatus;
  /** Called with the device name just before the switch is requested. */
  onSwitching: (name: string) => void;
  onClose: () => void;
}) {
  const { busy, run } = useAction();
  const [devices, setDevices] = useState<InputDevice[] | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    void api
      .audioDevices(recording.source)
      .then(setDevices)
      .catch((e) => setError(errorText(e)));
  }, [recording.source]);
  return (
    <Modal title={ui.liveSwitchDeviceTitle} onClose={() => !busy && onClose()}>
      <p className="field-hint">{ui.liveSwitchDeviceHint}</p>
      {error && <p className="notice warning">{error}</p>}
      {!devices && !error && <p>{ui.checking}</p>}
      <div className="device-choices">
        {devices?.map((device) => {
          const current = device.name === recording.deviceName;
          return (
            <button
              key={device.id}
              className={current ? 'active' : ''}
              aria-pressed={current}
              disabled={busy || current}
              onClick={() =>
                void run(async () => {
                  onSwitching(device.name);
                  await api.switchRecordingDevice(lectureId, device.id);
                  onClose();
                })
              }
            >
              <strong>{device.name}</strong>
              <small>
                {current
                  ? ui.liveSwitchDeviceCurrent
                  : device.isDefault
                    ? ui.liveSwitchDeviceDefault
                    : ''}
              </small>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
