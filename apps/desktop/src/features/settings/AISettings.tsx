import { useEffect, useRef, useState } from 'react';
import {
  ProviderKeyForm,
  useProviderKeyForm,
} from '../ai-providers/ProviderKeyForm';
import { ModelManagerCard } from '../model-manager/ModelManagerCard';
import { LiveSummarySetup } from '../study/LiveSummarySetup';
import { ProviderSettings } from './ProviderSettings';
import type { SettingsSectionProps } from './settings-types';
import type { ProviderStatus } from '../../types/domain';
import type { ActionRunner } from '../../hooks/useAction';
import type { AISection } from './SettingsNavigation';
import type { SettingsResources } from './useSettingsResources';
import { ui } from '../../i18n';

export function AISettings({
  section,
  onSection,
  resources,
  run,
  modelBlockedReason,
  providers,
  ...props
}: SettingsSectionProps & {
  section: AISection;
  onSection: (section: AISection) => void;
  resources: Pick<
    SettingsResources,
    'model' | 'setModel' | 'textModels' | 'setTextModels'
  >;
  run: ActionRunner;
  modelBlockedReason: string;
  providers: ProviderStatus[];
}) {
  const keyForm = useProviderKeyForm(run);
  const [keysOpen, setKeysOpen] = useState(false);
  const keys = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (keysOpen) keys.current?.scrollIntoView({ block: 'nearest' });
  }, [keysOpen]);
  const { model, setModel, textModels, setTextModels } = resources;
  const changeSection = (next: AISection) => {
    keyForm.setKey('');
    onSection(next);
  };
  return (
    <>
      <div
        className="settings-subnav"
        role="group"
        aria-label={ui.aiSettingsNavLabel}
      >
        {(
          [
            ['services', ui.aiSettingsServicesTab],
            ['models', ui.localModels],
            ['summaries', ui.aiSettingsSummariesTab],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={section === id}
            onClick={() => changeSection(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {section === 'services' && (
        <>
          <ProviderSettings
            {...props}
            providers={providers}
            onKeys={(provider) => {
              keyForm.setKey('');
              keyForm.setKeyProvider(provider);
              setKeysOpen(true);
            }}
            onLocal={() => changeSection('models')}
          />
          <details
            className="settings-key-panel"
            ref={keys}
            open={keysOpen}
            onToggle={(event) => {
              setKeysOpen(event.currentTarget.open);
              if (!event.currentTarget.open) keyForm.setKey('');
            }}
          >
            <summary>{ui.aiSettingsCloudApiKeys}</summary>
            <ProviderKeyForm
              settings={props.settings}
              busy={props.blocked}
              run={run}
              form={keyForm}
            />
          </details>
        </>
      )}
      {section === 'models' && (
        <>
          {modelBlockedReason && (
            <p className="notice" role="status">
              {modelBlockedReason}
            </p>
          )}
          <ModelManagerCard
            model={model}
            blocked={props.blocked}
            run={run}
            setModel={setModel}
          />
          {textModels.map((item) => (
            <ModelManagerCard
              key={item.id}
              model={item}
              blocked={props.blocked}
              run={run}
              setModel={(next) =>
                setTextModels((current) =>
                  current.map((entry) => (entry.id === next.id ? next : entry)),
                )
              }
            />
          ))}
        </>
      )}
      {section === 'summaries' && <LiveSummarySetup />}
    </>
  );
}
