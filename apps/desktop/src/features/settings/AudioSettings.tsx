import { useEffect, useState } from 'react';
import { api, errorText } from '../../api/client';
import { AudioInputTest } from './AudioInputTest';
import { ui } from '../../i18n';
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
      <h3>{ui.audioSource}</h3>
      <label>
        {ui.audioSettingsDefaultSource}
        <select
          aria-label={ui.audioSettingsDefaultSource}
          disabled={controlsBlocked}
          value={source}
          onChange={(event) =>
            setSettings({
              ...settings,
              audioSource: event.target.value as AppSettings['audioSource'],
            })
          }
        >
          <option value="microphone">{ui.microphone}</option>
          <option value="system">{ui.systemAudio}</option>
        </select>
      </label>
      <label>
        {source === 'microphone'
          ? ui.audioSettingsMicrophoneDevice
          : ui.audioSettingsSystemDevice}
        <select
          aria-label={ui.audioSettingsDeviceLabel}
          disabled={controlsBlocked || loading}
          value={selected}
          onChange={(event) =>
            setSettings({ ...settings, [deviceKey]: event.target.value })
          }
        >
          <option value="">{ui.audioSettingsUseWindowsDefault}</option>
          {selected && !devices.some((device) => device.id === selected) && (
            <option value={selected}>
              {ui.audioSettingsPreviousDeviceUnavailable}
            </option>
          )}
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name}
              {device.isDefault ? ui.audioSettingsDefaultSuffix : ''}
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
          {loading
            ? ui.audioSettingsFindingDevices
            : ui.audioSettingsRefreshDevices}
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
