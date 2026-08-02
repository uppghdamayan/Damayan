# Implementation Guide: Fix PDF Preview Zoom (Replace Iframe with react-pdf)

## Problem

The current file preview uses a native `<iframe>` pointing at a PDF URL. This renders the browser's built-in PDF viewer, whose zoom behavior is not controllable from the app — it always zooms toward its own center point instead of respecting the container, making it unusable inside a fixed-height preview panel.

## Goal

Replace the iframe-based preview with a self-rendered PDF viewer using `react-pdf` (a React wrapper around Mozilla's pdf.js). This gives full control over zoom scale, and since the rendered page lives inside a normal scrollable container, zooming in produces real scrollbars instead of a fixed center-locked view.

## Scope

- Applies to any component currently rendering a PDF via `<iframe src={fileUrl} />`.
- Known usages to update: Prescription preview, Diagnostics Request preview (see attached screenshots), and any other "FILE DETAILS" panel that previews a generated PDF.

## Steps

### 1. Install dependency

```bash
npm install react-pdf
```

### 2. Add the worker file

`react-pdf` needs pdf.js's worker script. Two options:

- **CDN (quick)**: point `pdfjs.GlobalWorkerOptions.workerSrc` at `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`.
- **Self-hosted (preferred for prod)**: copy `pdf.worker.min.mjs` from `node_modules/pdfjs-dist/build/` into `/public/pdf.worker.min.mjs`, then set `workerSrc` to `/pdf.worker.min.mjs`.

### 3. Create `components/PdfPreview.tsx`

A client component (`"use client"`) that:
- Uses `Document` and `Page` from `react-pdf`.
- Keeps `scale` in local state (default `1`), with zoom in/out buttons stepping by `0.25`, clamped between `0.5` and `3`.
- Renders `Page` inside a `div` with `overflow-auto` and a fixed height — this is what makes zoom scrollable instead of center-locked.
- Includes page navigation (`pageNumber` state) for multi-page PDFs.
- Reimplements the existing toolbar actions (zoom %, download, print, fullscreen) so the UI matches the current "FILE DETAILS" panel design.

Reference implementation already generated: `PdfPreview.tsx` (see prior message in this conversation / attached file).

### 4. Replace iframe usages

Find all instances of:

```tsx
<iframe src={fileUrl} className="..." />
```

Replace with:

```tsx
<PdfPreview fileUrl={fileUrl} fileName={fileName} />
```

Remove any now-unused iframe-specific zoom/print/download logic that was working around iframe limitations (e.g., manual `postMessage` calls into the iframe, or reliance on `#zoom=` URL fragments).

### 5. Verify

- [ ] Zoom in past 150% and confirm scrollbars appear and content is reachable in all directions, not just the center.
- [ ] Zoom controls disable correctly at min (`50%`) and max (`300%`).
- [ ] Multi-page documents (e.g., a 2-page Diagnostics Request) paginate correctly.
- [ ] Download button produces the same file as before.
- [ ] Print button opens a printable view of the correct PDF.
- [ ] Component renders correctly inside the existing "FILE DETAILS" side panel width/height constraints.
- [ ] No console errors about the pdf.js worker failing to load (check Network tab if self-hosting the worker).

### 6. Notes / follow-ups

- If a full-featured toolbar (thumbnails, search, rotate) becomes a requirement later, `@react-pdf-viewer/core` is a drop-in alternative that solves the same zoom issue with more built-in UI, at the cost of less control over matching the existing design.
- `renderTextLayer` / `renderAnnotationLayer` are enabled in the reference component so text stays selectable when zoomed — keep these on unless there's a specific performance reason to disable them.