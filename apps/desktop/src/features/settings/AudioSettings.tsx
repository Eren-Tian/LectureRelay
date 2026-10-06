import { useEffect, useState } from 'react';
import { api, errorText } from '../../api/client';
import { AudioInputTest } from './AudioInputTest';
import type { AppSettings, InputDevice } from '../../types/domain';
import type { SettingsSectionProps } from './settings-types';

export function AudioSettings({
  settings,
  setSettings,
  blocked,
}: SettingsSectionProps) {
  const [testing, setTesting] = useState(false);
  const source = settings.audioSource;
  const [catalog, setCatalog] = useState<{
    source: AppSettings['audioSource'];
    items: InputDevice[];
  }>();
  const [error, setError] = useState<{
    source: AppSettings['audioSource'];
    message: string;
  }>();
  const [fetching, setFetching] = useState(true);
  const [revision, refresh] = useState(0);
  useEffect(() => {
    let disposed = false;
    setFetching(true);
    setError(undefined);
    void api
      .audioDevices(source)
      .then((items) => {
        if (!disposed) setCatalog({ source, items });
      })
      .catch((failure) => {
        if (!disposed) {
          setCatalog({ source, items: [] });
          setError({ source, message: errorText(failure) });
        }
      })
      .finally(() => {
        if (!disposed) setFetching(false);
      });
    return () => {
      disposed = true;
    };
  }, [source, revision]);
  const loading = fetching || catalog?.source !== source;
  const devices = catalog?.source === source ? catalog.items : [];
  const controlsBlocked = blocked || testing;
  const deviceKey =
    source === 'microphone' ? 'microphoneDeviceId' : 'systemDeviceId';
  const selected = settings[deviceKey];
  return (
    <section className="settings-card">
      <h3>声音来源</h3>
      <label>
        默认声音来源
        <select
          aria-label="默认声音来源"
          disabled={controlsBlocked}
          value={source}
          onChange={(event) =>
            setSettings({
              ...settings,
              audioSource: event.target.value as AppSettings['audioSource'],
            })
          }
        >
          <option value="microphone">麦克风</option>
          <option value="system">系统声音</option>
        </select>
      </label>
      <label>
        {source === 'microphone' ? '麦克风设备' : '系统播放设备'}
        <select
          aria-label="声音设备"
          disabled={controlsBlocked || loading}
          value={selected}
          onChange={(event) =>
            setSettings({ ...settings, [deviceKey]: event.target.value })
          }
        >
          <option value="">使用 Windows 默认设备</option>
          {selected && !devices.some((device) => device.id === selected) && (
            <option value={selected}>此前选择的设备不可用</option>
          )}
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name}
              {device.isDefault ? '（默认）' : ''}
            </option>
          ))}
        </select>
      </label>
      {error?.source === source && (
        <p role="alert" className="audio-warning">
          {error.message}
        </p>
      )}
      <div className="settings-device-actions">
        <button
          className="text-button"
          disabled={loading || controlsBlocked}
          onClick={() => refresh((current) => current + 1)}
        >
          {loading ? '正在查找设备…' : '刷新设备列表'}
        </button>
      </div>
      <AudioInputTest
        source={source}
        deviceId={selected}
        disabled={loading || controlsBlocked}
        onTesting={setTesting}
      />
    </section>
  );
}
