import type { Dispatch, SetStateAction } from 'react';
import type { AppSettings } from '../../types/domain';

export interface SettingsSectionProps {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  blocked: boolean;
}
