import { ui } from '../i18n';
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {
  type Bootstrap,
  type JobStatus,
  type RecordingStatus,
  type LiveStatus,
} from '../types/domain';
import { type Route } from './routes';
import { Modal } from '../components/Modal';

interface Confirmation {
  title: string;
  body: string;
  action: string;
  danger?: boolean;
}
interface WorkspaceValue {
  data: Bootstrap;
  route: Route;
  recording: RecordingStatus | null;
  job: JobStatus | null;
  live: LiveStatus | null;
  navigate: (route: Route) => void;
  refresh: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
  confirm: (options: Confirmation) => Promise<boolean>;
}
const Workspace = createContext<WorkspaceValue | null>(null);
export function useWorkspace() {
  const workspace = useContext(Workspace);
  if (!workspace) throw new Error('Workspace unavailable');
  return workspace;
}
export function WorkspaceProvider({
  value,
  children,
}: {
  value: Omit<WorkspaceValue, 'confirm'>;
  children: ReactNode;
}) {
  const [dialog, setDialog] = useState<
    (Confirmation & { resolve: (answer: boolean) => void }) | null
  >(null);
  const pending = useRef(false);
  const confirm = useCallback(
    (options: Confirmation) =>
      new Promise<boolean>((resolve) => {
        if (pending.current) {
          resolve(false);
          return;
        }
        pending.current = true;
        setDialog({ ...options, resolve });
      }),
    [],
  );
  const close = useCallback(() => {
    dialog?.resolve(false);
    pending.current = false;
    setDialog(null);
  }, [dialog]);
  return (
    <Workspace.Provider value={{ ...value, confirm }}>
      {children}
      {dialog && (
        <Modal title={dialog.title} onClose={close}>
          <p className="modal-copy">{dialog.body}</p>
          <div className="form-actions">
            <button className="button secondary" onClick={close}>
              {ui.s258}
            </button>
            <button
              className={`button ${dialog.danger ? 'danger' : 'primary'}`}
              onClick={() => {
                dialog.resolve(true);
                pending.current = false;
                setDialog(null);
              }}
            >
              {dialog.action}
            </button>
          </div>
        </Modal>
      )}
    </Workspace.Provider>
  );
}
