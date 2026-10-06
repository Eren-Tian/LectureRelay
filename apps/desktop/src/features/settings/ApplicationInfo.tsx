import { Icon } from '../../components/Icon';
import { useWorkspace } from '../../app/Workspace';
import { ui } from '../../i18n';

export function PrivacySettings() {
  return (
    <>
      <section className="settings-card">
        <h3>{ui.privacyDataLocationTitle}</h3>
        <div className="privacy-row">
          <Icon name="folder" />
          <div>
            <strong>{ui.privacyStoredLocallyTitle}</strong>
            <p>{ui.privacyStoredLocallyBody}</p>
          </div>
        </div>
        <div className="privacy-row">
          <Icon name="cloud" />
          <div>
            <strong>{ui.privacyCloudUploadTitle}</strong>
            <p>{ui.privacyCloudUploadBody}</p>
          </div>
        </div>
        <p className="field-hint">{ui.privacyApiKeyHint}</p>
      </section>
    </>
  );
}

export function AboutSettings() {
  const workspace = useWorkspace();
  return (
    <section className="settings-card about-card">
      <h2>LectureRelay</h2>
      <span className="pill">
        {ui.aboutVersion(workspace.data.storage.version)} · Windows
      </span>
      <dl className="storage-list">
        <div>
          <dt>{ui.aboutInterfaceLanguage}</dt>
          <dd>{ui.aboutInterfaceLanguageValue}</dd>
        </div>
        <div>
          <dt>{ui.aboutTranslationLanguages}</dt>
          <dd>{ui.aboutTranslationLanguagesValue}</dd>
        </div>
        <div>
          <dt>{ui.aboutProjectLicense}</dt>
          <dd>{ui.aboutLicenseUndecided}</dd>
        </div>
        <div>
          <dt>{ui.aboutOpenSourceComponents}</dt>
          <dd>{ui.aboutThirdPartyNotices}</dd>
        </div>
        <div>
          <dt>{ui.aboutSourceRepository}</dt>
          <dd>github.com/Eren-Tian/LectureRelay</dd>
        </div>
      </dl>
    </section>
  );
}
