import { ui } from '../i18n';

export function ResourceState({
  error,
  reload,
}: {
  error: string;
  reload: () => Promise<void>;
}) {
  return (
    <div className="empty-state small">
      {error ? (
        <>
          <h2>{ui.unableToOpen}</h2>
          <p>{error}</p>
          <button className="button secondary" onClick={() => void reload()}>
            {ui.tryAgain}
          </button>
        </>
      ) : (
        <>
          <div className="spinner" />
          <p>{ui.openingCourse}</p>
        </>
      )}
    </div>
  );
}
