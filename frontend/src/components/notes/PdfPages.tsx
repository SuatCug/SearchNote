import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

const PAGE_BATCH = 3;

// pdf.js sadece bir PDF önizlemesi açıldığında yüklenir (ana paketi büyütmemek için).
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | undefined;
const loadPdfjs = () => {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsPromise;
};

// PDF sayfalarını canvas'a çizer. Tarayıcının kendi PDF görüntüleyicisine bağlı olmadığı için
// mobil tarayıcılarda da (Android Chrome iframe içinde PDF göstermez) aynı şekilde çalışır.
// targetPage: içerik aramasından gelinen sayfa; o sayfaya kadar çizilir, kaydırılır ve kısa süre vurgulanır.
export default function PdfPages({ blob, targetPage }: { blob: Blob; targetPage?: number }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(Math.max(PAGE_BATCH, targetPage ?? 0));
  // Hedef sayfa değişince (örn. quizdeki "see page 4") o sayfaya kadar açılır.
  const [lastTarget, setLastTarget] = useState(targetPage);
  if (lastTarget !== targetPage) {
    setLastTarget(targetPage);
    if (targetPage && targetPage > visibleCount) setVisibleCount(targetPage);
  }

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    loadPdfjs()
      .then(async (pdfjs) => {
        loadingTask = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
        const pdf = await loadingTask.promise;
        if (!cancelled) setDoc(pdf);
      })
      .catch(() => !cancelled && setError('Could not render the PDF preview. Download the file to open it.'));
    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [blob]);

  if (error) return <p className="py-16 text-center text-sm text-gray-500">{error}</p>;
  if (!doc) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-gray-500">
        <Loader2 size={18} className="animate-spin" /> Preparing preview...
      </div>
    );
  }

  const shown = Math.min(visibleCount, doc.numPages);

  return (
    <div className="max-h-[75vh] overflow-y-auto space-y-4 px-1 py-1">
      {Array.from({ length: shown }, (_, i) => (
        <PdfPage key={i + 1} doc={doc} pageNumber={i + 1} isTarget={targetPage === i + 1} />
      ))}
      <div className="flex flex-col items-center gap-2 pb-2 text-xs text-gray-500">
        <span>
          Showing {shown} of {doc.numPages} pages
        </span>
        {shown < doc.numPages && (
          <button type="button" onClick={() => setVisibleCount((c) => c + PAGE_BATCH)} className="btn-secondary py-1.5 text-xs">
            Show more pages
          </button>
        )}
      </div>
    </div>
  );
}

function PdfPage({ doc, pageNumber, isTarget }: { doc: PDFDocumentProxy; pageNumber: number; isTarget: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);

  // Hedef sayfa çizilince görünür alana kaydırılır.
  useEffect(() => {
    if (isTarget && rendered) wrapperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isTarget, rendered]);

  useEffect(() => {
    let renderTask: RenderTask | undefined;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(pageNumber);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      // Kapsayıcı genişliğine sığdır, yüksek DPI ekranlarda net görünsün diye piksel oranıyla çarp.
      const cssWidth = canvas.parentElement?.clientWidth ?? canvas.clientWidth;
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = (cssWidth / baseViewport.width) * Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      renderTask = page.render({ canvas, viewport });
      await renderTask.promise;
      if (!cancelled) setRendered(true);
    })().catch(() => {
      // Render iptali (sayfadan çıkıldı) veya bozuk sayfa: sessizce yok sayılır.
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, pageNumber]);

  return (
    // Çizilene kadar A4 oranında yer tutulur, böylece sayfa yüklenirken zıplamaz.
    <div
      ref={wrapperRef}
      className={`relative mx-auto w-full max-w-[720px] scroll-mt-20 bg-white shadow-md ${isTarget ? 'ring-4 ring-amber-300' : ''}`}
      style={rendered ? undefined : { aspectRatio: '1 / 1.414' }}
    >
      <canvas ref={canvasRef} className="block w-full h-auto" aria-label={`Page ${pageNumber}`} />
      {!rendered && <div className="absolute inset-0 skeleton-box" />}
    </div>
  );
}
