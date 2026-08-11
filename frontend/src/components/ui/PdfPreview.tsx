'use client';

import { useCallback, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ExternalLink } from 'lucide-react';
import { Spinner } from './spinner';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

interface PdfPreviewProps {
  fileUrl: string;
}

/**
 * Self-rendered PDF viewer (react-pdf / pdf.js) used in place of a raw <iframe src={pdfUrl} />.
 * The browser's built-in PDF viewer brings its own toolbar (thumbnails, zoom, print, an AI
 * "Summarize" button) that has nothing to do with this app, and its zoom always re-centers on
 * itself instead of respecting the container. Rendering the page into a normal scrollable div
 * gives us our own minimal toolbar and turns zoom into real, reachable scrollbars.
 * See Implementation.md ("Fix PDF Preview Zoom") for the full background.
 *
 * Callers should pass `key={fileUrl}` when the same mounted instance can be pointed at a new
 * file, so page/zoom/error state resets via remount instead of an effect.
 */
export function PdfPreview({ fileUrl }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [loadError, setLoadError] = useState(false);

  const zoomOut = useCallback(() => setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2))), []);
  const zoomIn = useCallback(() => setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2))), []);

  if (loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center">
        <p className="text-[13px] text-text-secondary">Couldn&apos;t render this PDF.</p>
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 inline-flex items-center gap-1.5"
        >
          <ExternalLink className="w-3 h-3" /> Open in new tab
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-center gap-1.5 pb-2 shrink-0">
        {numPages && numPages > 1 && (
          <>
            <button
              type="button"
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              className="h-6 w-6 rounded-btn flex items-center justify-center text-text-muted hover:text-accent hover:bg-surface-2 border border-transparent hover:border-border transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-text-secondary tabular-nums px-1 min-w-[48px] text-center">
              {pageNumber} / {numPages}
            </span>
            <button
              type="button"
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
              className="h-6 w-6 rounded-btn flex items-center justify-center text-text-muted hover:text-accent hover:bg-surface-2 border border-transparent hover:border-border transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <span className="w-px h-4 bg-border mx-1" />
          </>
        )}
        <button
          type="button"
          onClick={zoomOut}
          disabled={scale <= MIN_SCALE}
          className="h-6 w-6 rounded-btn flex items-center justify-center text-text-muted hover:text-accent hover:bg-surface-2 border border-transparent hover:border-border transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] font-mono text-text-secondary tabular-nums w-10 text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={zoomIn}
          disabled={scale >= MAX_SCALE}
          className="h-6 w-6 rounded-btn flex items-center justify-center text-text-muted hover:text-accent hover:bg-surface-2 border border-transparent hover:border-border transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrollable page viewport — this is what makes zoom scrollable instead of center-locked */}
      <div className="flex-1 min-h-0 overflow-auto rounded-[6px] border border-border bg-surface-2 flex justify-center p-3">
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          onLoadError={() => setLoadError(true)}
          loading={
            <div className="flex flex-col items-center gap-2 text-text-muted text-[12px] py-10">
              <Spinner size="md" />
              Rendering PDF…
            </div>
          }
          error={null}
        >
          <Page pageNumber={pageNumber} scale={scale} renderTextLayer renderAnnotationLayer className="shadow-sm" />
        </Document>
      </div>
    </div>
  );
}
