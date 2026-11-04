"""Text extraction for one evidence file, run as an isolated subprocess (python -I extract_worker.py <type> <path>).

Runs outside the web server so a malformed or hostile file can only crash or time out this process.
It only reads text: no macros, embedded objects or external links are executed or fetched.
Prints one JSON object: {"status": "done"|"manual"|"failed", "note", "page_count", "chunks": [{"location", "text"}]}
Locations are real: PDF page numbers, or DOCX headings / paragraph numbers / table numbers (DOCX has no pages).
"""
import json
import sys

CHUNK = 1500
MAX_PAGES = int(sys.argv[3]) if len(sys.argv) > 3 else 500
MAX_CHARS = int(sys.argv[4]) if len(sys.argv) > 4 else 2_000_000


def split(location, text, out):
    text = ' '.join(text.split())
    if not text:
        return
    parts = [text[i:i + CHUNK] for i in range(0, len(text), CHUNK)]
    for n, part in enumerate(parts, 1):
        out.append({'location': location if len(parts) == 1 else f'{location} (part {n})', 'text': part})


def pdf(path):
    from pypdf import PdfReader
    reader = PdfReader(path, strict=False)
    if reader.is_encrypted:
        try:
            if not reader.decrypt(''):
                return {'status': 'manual', 'note': 'The PDF is password protected; manual verification required.', 'chunks': []}
        except Exception:  # noqa: BLE001
            return {'status': 'manual', 'note': 'The PDF is encrypted; manual verification required.', 'chunks': []}
    chunks, total = [], 0
    pages = len(reader.pages)
    for i, page in enumerate(reader.pages[:MAX_PAGES], 1):
        try:
            text = page.extract_text() or ''
        except Exception:  # noqa: BLE001 - one bad page must not stop the rest
            text = ''
        total += len(text)
        if total > MAX_CHARS:
            break
        split(f'page {i}', text, chunks)
    note = f'Only the first {MAX_PAGES} of {pages} pages were read.' if pages > MAX_PAGES else ''
    if sum(len(c['text']) for c in chunks) < 20:
        return {'status': 'manual', 'page_count': pages, 'chunks': [],
                'note': 'No extractable text (probably a scanned document); manual verification required.'}
    return {'status': 'done', 'page_count': pages, 'chunks': chunks, 'note': note}


def docx(path):
    from docx import Document
    doc = Document(path)
    chunks, buf, section, start, total = [], [], 'start of document', 1, 0

    def flush(end):
        if buf:
            split(f'{section}, paragraphs {start}-{end}', ' '.join(buf), chunks)

    for i, p in enumerate(doc.paragraphs, 1):
        text = p.text.strip()
        total += len(text)
        if total > MAX_CHARS:
            break
        if p.style is not None and p.style.name.lower().startswith('heading') and text:
            flush(i - 1)
            buf, section, start = [], f'section "{text[:60]}"', i + 1
            continue
        if text:
            buf.append(text)
    flush(len(doc.paragraphs))
    for t, table in enumerate(doc.tables, 1):
        rows = [' | '.join(c.text.strip() for c in r.cells) for r in table.rows]
        split(f'table {t}', ' ; '.join(rows), chunks)
    if sum(len(c['text']) for c in chunks) < 20:
        return {'status': 'manual', 'chunks': [], 'note': 'The document contains no readable text; manual verification required.'}
    return {'status': 'done', 'chunks': chunks, 'note': ''}


def main():
    kind, path = sys.argv[1], sys.argv[2]
    try:
        result = pdf(path) if kind == 'pdf' else docx(path) if kind == 'docx' else {'status': 'failed', 'note': 'Unsupported type', 'chunks': []}
    except Exception as e:  # noqa: BLE001 - malformed file
        result = {'status': 'failed', 'chunks': [], 'note': f'The file could not be read ({type(e).__name__}).'}
    sys.stdout.write(json.dumps(result))


if __name__ == '__main__':
    main()
