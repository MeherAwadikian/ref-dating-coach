// Screenshot -> text. Lazy-loads tesseract.js (WASM, Apache-2.0) only when used,
// so it never bloats the initial bundle. Worker + language data load from CDN at
// first use. OCR on chat bubbles is imperfect; always let the user edit the result.
export async function ocrImage(
  file: Blob,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const { default: Tesseract } = await import('tesseract.js');
  const { data } = await Tesseract.recognize(file, 'eng', {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text' && onProgress) onProgress(m.progress);
    },
  });
  return (data.text || '').replace(/\n{3,}/g, '\n\n').trim();
}
