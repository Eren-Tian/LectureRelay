// Test-only entry, excluded from the production Vite entry graph.
// Exercises the real reader with deterministic delayed provider responses.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LiveCaptions } from '../../src/features/live-lecture/LiveCaptions';
import { nextLiveStatus } from '../../src/lib/live-status';
import '../../src/styles/app.css';
import type {
  AppSettings,
  AssistanceLanguage,
  LiveStatus,
  TranscriptSegment,
} from '../../src/types/domain';
const settings: AppSettings = {
  assistanceLanguage: 'zh',
  provider: 'none',
  chatModel: 'fixture',
  translationMode: 'local',
  translationModel: 'hy-mt2-1.8b',
  studyMode: 'local',
  speechProvider: 'local',
  localModel: '',
  audioSource: 'system',
  microphoneDeviceId: '',
  systemDeviceId: '',
  liveTranslation: true,
  englishFontSize: 22,
  translationFontSize: 18,
  showEnglish: true,
  showTranslation: true,
  autoScroll: true,
  theme: 'light',
  quietMode: true,
};
const translations = {
  zh: '把新知识与已知的事物联系起来，会让学习更轻松。',
  ja: '新しい知識を知っていることと結びつけると、学びやすくなります。',
  ko: '새로운 지식을 이미 아는 것과 연결하면 더 쉽게 배울 수 있습니다.',
};
const segment = (i: number): TranscriptSegment => ({
  id: `fixture:${i}:0`,
  lectureId: 'fixture',
  startSeconds: i * 2,
  endSeconds: i * 2 + 2,
  sourceText: `Idea ${i + 1}. Learning becomes easier when we connect new ideas to what we already know.`,
  translatedText: '',
  origin: 'cloud',
  provider: 'fixture',
  status: 'final',
  transcriptVersion: 'fixture',
});
function Fixture() {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [draft, setDraft] = useState<LiveStatus['draft']>(null);
  const [language, setLanguage] = useState<AssistanceLanguage>('zh');
  const [failed, setFailed] = useState(false);
  const [following, setFollowing] = useState(true);
  const [previews, setPreviews] = useState<LiveStatus['translationPreviews']>(
    [],
  );
  const [showEnglish, setShowEnglish] = useState(true);
  const pending = segments.filter((s) => !s.translatedText).map((s) => s.id);
  return (
    <div
      style={{
        height: '100vh',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div className="button-row">
        <strong>TEST FIXTURE · synthetic translation</strong>
        <select
          aria-label="Fixture language"
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value as AssistanceLanguage);
            setSegments([]);
            setDraft(null);
          }}
        >
          <option value="zh">Chinese</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
        </select>
        <button
          id="partial"
          onClick={() =>
            setDraft({
              id: `fixture:${segments.length}`,
              startSeconds: segments.length * 2,
              endSeconds: segments.length * 2 + 1,
              partialText: 'Learning becomes easier when we connect',
              status: 'partial',
            })
          }
        >
          Partial
        </button>
        <button
          id="final"
          onClick={() => {
            setSegments((v) => [...v, segment(v.length)]);
            setDraft(null);
          }}
        >
          Finalize
        </button>
        <button
          id="translate"
          onClick={() =>
            setSegments((v) =>
              v.map((s) => ({ ...s, translatedText: translations[language] })),
            )
          }
        >
          Translate
        </button>
        <button
          id="seed"
          onClick={() =>
            setSegments(Array.from({ length: 40 }, (_, i) => segment(i)))
          }
        >
          40 captions
        </button>
        <button id="failure" onClick={() => setFailed(true)}>
          Fail
        </button>
        <button
          id="trim"
          onClick={() => setSegments((v) => [...v.slice(1), segment(100)])}
        >
          Trim & append
        </button>
        <button id="manual" onClick={() => setFollowing(false)}>
          Disable follow
        </button>
        <div hidden>
          <button
            id="preview"
            onClick={() =>
              setPreviews(
                draft
                  ? [
                      {
                        id: `${draft.id}:0`,
                        sourceText: draft.partialText,
                        sourceRevision: 1,
                        language,
                        translatedText: translations[language],
                        kind: 'draft',
                      },
                    ]
                  : [],
              )
            }
          >
            Preview
          </button>
          <button
            id="revise"
            onClick={() =>
              setDraft(
                (d) =>
                  d && {
                    ...d,
                    partialText:
                      'Learning does not become easier when we connect',
                  },
              )
            }
          >
            Revise
          </button>
          <button
            id="wrong-language"
            onClick={() =>
              setPreviews((p) => p?.map((v) => ({ ...v, language: 'de' })))
            }
          >
            Wrong target
          </button>
          <button id="hide-english" onClick={() => setShowEnglish(false)}>
            Translation only
          </button>
          <button
            id="preview-finals"
            onClick={() =>
              setPreviews(
                segments.map((s) => ({
                  id: s.id,
                  sourceText: s.sourceText,
                  sourceRevision: 0,
                  language,
                  translatedText: translations[language].repeat(4),
                  kind: 'final',
                })),
              )
            }
          >
            Stream final translations
          </button>
          <output id="ordering">
            {(() => {
              const current = { generation: 2, sequence: 5 } as LiveStatus;
              return JSON.stringify({
                oldPoll:
                  nextLiveStatus(current, {
                    generation: 2,
                    sequence: 4,
                  } as LiveStatus) === current,
                oldClass:
                  nextLiveStatus(current, {
                    generation: 1,
                    sequence: 99,
                  } as LiveStatus) === current,
                newClass:
                  nextLiveStatus(current, {
                    generation: 3,
                    sequence: 0,
                  } as LiveStatus).generation === 3,
              });
            })()}
          </output>
        </div>
      </div>
      <div className="live-page" style={{ margin: 0, maxWidth: 'none' }}>
        <section className="live-caption-area">
          <div className="caption-heading">
            <strong>Live captions</strong>
            <span>English → {language}</span>
          </div>
          <LiveCaptions
            key={language + following}
            segments={segments}
            draft={draft}
            translation={{
              enabled: true,
              configured: true,
              pendingIds: failed ? [] : pending,
              deferredIds: failed ? pending : [],
              message: null,
            }}
            settings={{ ...settings, autoScroll: following, showEnglish }}
            language={language}
            listening
            previews={previews}
          />
          <div className="caption-footer">
            <span>Fixture only</span>
          </div>
        </section>
        <footer className="classroom-controls">
          <p>Test-only content</p>
          <button className="button primary">Stop & save</button>
        </footer>
      </div>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
