import { ui } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { api, errorText } from '../../api/client';
import type { CourseDocument } from '../../types/domain';
GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfPanel({
  courseId,
  documents,
  onAttach,
}: {
  courseId: string;
  documents: CourseDocument[];
  onAttach: () => void;
}) {
  const [id, setId] = useState(documents[0]?.id ?? ''),
    [page, setPage] = useState(1),
    [zoom, setZoom] = useState(1),
    [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [text, setText] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null),
    view = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);
  useEffect(() => {
    if (!id && documents.length) setId(documents[0].id);
  }, [documents, id]);
  useEffect(() => {
    const el = view.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) => {
      if (e.contentRect.width > 0) setWidth(e.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let alive = true;
    let task: ReturnType<typeof getDocument> | undefined;
    setPdf(null);
    setPage(1);
    setError('');
    if (!id) return;
    setLoading(true);
    void api
      .readDocument(courseId, id)
      .then((data) => {
        if (!alive) return;
        task = getDocument({
          data: new Uint8Array(data),
          isEvalSupported: false,
          useSystemFonts: true,
          enableXfa: false,
        });
        return task.promise;
      })
      .then((doc) => {
        if (alive && doc) setPdf(doc);
      })
      .catch((e) => {
        if (alive) setError(errorText(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      void task?.destroy();
    };
  }, [id, courseId]);
  useEffect(() => {
    let active = true;
    let render:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']>
      | undefined;
    if (!pdf || !canvas.current) return;
    setText('');
    void pdf
      .getPage(page)
      .then(async (p) => {
        if (!active || !canvas.current) return;
        const base = p.getViewport({ scale: 1 }),
          viewport = p.getViewport({
            scale: Math.min(3, ((width - 24) / base.width) * zoom),
          }),
          scale = Math.min(2, devicePixelRatio);
        const el = canvas.current;
        el.width = viewport.width * scale;
        el.height = viewport.height * scale;
        el.style.width = viewport.width + 'px';
        el.style.height = viewport.height + 'px';
        render = p.render({
          canvas: el,
          viewport,
          transform: [scale, 0, 0, scale, 0, 0],
        });
        await render.promise;
        if (!active) return;
        const content = await p.getTextContent();
        if (active)
          setText(
            content.items.map((i) => ('str' in i ? i.str : '')).join(' '),
          );
      })
      .catch((e) => {
        if (active && e?.name !== 'RenderingCancelledException')
          setError(errorText(e));
      });
    return () => {
      active = false;
      render?.cancel();
    };
  }, [pdf, page, zoom, width]);
  return (
    <div className="pdf-panel">
      <div className="study-toolbar">
        <select
          aria-label={ui.pdfCourseDocumentLabel}
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          <option value="">{ui.pdfChoose}</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button className="button secondary" onClick={onAttach}>
          {ui.pdfAdd}
        </button>
      </div>
      {pdf && (
        <div className="study-toolbar">
          <button
            className="button secondary"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            ←
          </button>
          <label>
            {ui.pdfPageLabel}
            <input
              aria-label={ui.pdfPageNumberLabel}
              type="number"
              min={1}
              max={pdf.numPages}
              value={page}
              onChange={(e) =>
                setPage(
                  Math.max(
                    1,
                    Math.min(pdf.numPages, Number(e.target.value) || 1),
                  ),
                )
              }
            />
          </label>
          <span>/ {pdf.numPages}</span>
          <button
            className="button secondary"
            disabled={page === pdf.numPages}
            onClick={() => setPage(page + 1)}
          >
            →
          </button>
          <select
            aria-label={ui.pdfZoomLabel}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            {[0.75, 1, 1.25, 1.5].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? ui.pdfFitWidth : Math.round(n * 100) + '%'}
              </option>
            ))}
          </select>
        </div>
      )}
      {error && (
        <p role="alert" className="notice warning">
          {error}
        </p>
      )}
      {loading && <p role="status">{ui.pdfOpening}</p>}
      <div ref={view} className="pdf-canvas-scroll">
        <canvas
          ref={canvas}
          aria-label={ui.pdfCanvasLabel(page)}
          hidden={!pdf}
        />
        {!id && <p className="empty-state">{ui.pdfEmpty}</p>}
      </div>
      {pdf && (
        <details>
          <summary>{ui.pdfPageText(page)}</summary>
          <p className="pdf-text">{text || ui.pdfNoText}</p>
        </details>
      )}
    </div>
  );
}
