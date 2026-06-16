import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mocks
// ============================================================

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { uploadFile, readTextFile, extractPdfText } from './fileUpload';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile as tauriReadTextFile, stat } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';

// Simulate Tauri webview environment so existing tests pass
(window as any).__TAURI_INTERNALS__ = {};

// ============================================================
// Helpers
// ============================================================

function mockFileSelect(filePath: string | null) {
  vi.mocked(open).mockResolvedValue(filePath);
}

function mockFileSize(sizeInBytes: number) {
  vi.mocked(stat).mockResolvedValue({ size: sizeInBytes } as unknown as Awaited<ReturnType<typeof stat>>);
}

function mockTextContent(content: string) {
  vi.mocked(tauriReadTextFile).mockResolvedValue(content);
}

function mockPdfExtraction(content: string | Error) {
  if (content instanceof Error) {
    vi.mocked(invoke).mockRejectedValue(content);
  } else {
    vi.mocked(invoke).mockResolvedValue(content);
  }
}

const ONE_MB = 1024 * 1024;

// ============================================================
// Tests — uploadFile
// ============================================================

describe('uploadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- No file selected ---

  it('should throw when no file is selected', async () => {
    mockFileSelect(null);

    await expect(uploadFile()).rejects.toThrow('No file selected');
  });

  // --- Valid .txt file ---

  it('should upload a valid .txt file', async () => {
    mockFileSelect('/home/user/notes.txt');
    mockFileSize(1024);
    mockTextContent('Hello world from text file');

    const result = await uploadFile();

    expect(result).toEqual({
      content: 'Hello world from text file',
      fileName: 'notes.txt',
      fileType: 'txt',
    });
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [{ name: 'Documents', extensions: ['txt', 'md', 'pdf'] }],
        multiple: false,
      })
    );
    expect(stat).toHaveBeenCalledWith('/home/user/notes.txt');
    expect(tauriReadTextFile).toHaveBeenCalledWith('/home/user/notes.txt');
  });

  // --- Valid .md file ---

  it('should upload a valid .md file', async () => {
    mockFileSelect('/home/user/readme.md');
    mockFileSize(2048);
    mockTextContent('# Markdown Title\n\nSome content');

    const result = await uploadFile();

    expect(result).toEqual({
      content: '# Markdown Title\n\nSome content',
      fileName: 'readme.md',
      fileType: 'md',
    });
  });

  // --- Valid .pdf file ---

  it('should extract text from PDF via Rust command', async () => {
    const extractedText = 'Chapter 1: Introduction\nThis is the content.';
    mockFileSelect('/home/user/doc.pdf');
    mockFileSize(5000);
    mockPdfExtraction(extractedText);

    const result = await uploadFile();

    expect(result).toEqual({
      content: extractedText,
      fileName: 'doc.pdf',
      fileType: 'pdf',
    });
    expect(invoke).toHaveBeenCalledWith('extract_pdf_text', { path: '/home/user/doc.pdf' });
    expect(tauriReadTextFile).not.toHaveBeenCalled();
  });

  // --- Unsupported file type ---

  it('should reject unsupported file types', async () => {
    mockFileSelect('/home/user/image.png');

    await expect(uploadFile()).rejects.toThrow('Unsupported file format');
  });

  // --- No extension ---

  it('should reject files with no extension', async () => {
    mockFileSelect('/home/user/Makefile');

    await expect(uploadFile()).rejects.toThrow('Unsupported file format');
  });

  // --- File too large ---

  it('should reject files exceeding 10MB limit', async () => {
    mockFileSelect('/home/user/large.txt');
    mockFileSize(11 * ONE_MB); // 11MB

    await expect(uploadFile()).rejects.toThrow('File size exceeds the maximum limit');
  });

  // --- File exactly at limit (should pass) ---

  it('should accept files at exactly 10MB', async () => {
    mockFileSelect('/home/user/exact.txt');
    mockFileSize(10 * ONE_MB);
    mockTextContent('x'.repeat(10 * ONE_MB));

    const result = await uploadFile();

    expect(result.fileType).toBe('txt');
    expect(result.content.length).toBe(10 * ONE_MB);
  });

  // --- PDF returns empty text (scanned/image-only) ---

  it('should reject scanned/image-only PDFs that yield empty text', async () => {
    mockFileSelect('/home/user/scanned.pdf');
    mockFileSize(5000);
    mockPdfExtraction('   \n  '); // whitespace only

    await expect(uploadFile()).rejects.toThrow('image-only or scanned');
  });

  // --- PDF returns truly empty string ---

  it('should reject PDFs with empty extraction result', async () => {
    mockFileSelect('/home/user/empty.pdf');
    mockFileSize(5000);
    mockPdfExtraction('');

    await expect(uploadFile()).rejects.toThrow('image-only or scanned');
  });

  // --- PDF extraction failure ---

  it('should throw when PDF extraction command fails', async () => {
    mockFileSelect('/home/user/corrupt.pdf');
    mockFileSize(5000);
    mockPdfExtraction(new Error('PDF extraction failed: Corrupt PDF'));

    await expect(uploadFile()).rejects.toThrow('PDF extraction failed');
  });

  // --- Windows-style path ---

  it('should handle Windows-style file paths', async () => {
    mockFileSelect('C:\\Users\\test\\document.md');
    mockFileSize(500);
    mockTextContent('# Windows doc');

    const result = await uploadFile();

    expect(result.fileName).toBe('document.md');
    expect(result.fileType).toBe('md');
  });

  // --- Non-Tauri environment ---

  it('should throw when not running inside Tauri webview', async () => {
    const origTAURI = (window as any).__TAURI_INTERNALS__;
    delete (window as any).__TAURI_INTERNALS__;

    await expect(uploadFile()).rejects.toThrow(
      'requires the Tauri desktop app'
    );

    (window as any).__TAURI_INTERNALS__ = origTAURI;
  });
});

// ============================================================
// Tests — readTextFile
// ============================================================

describe('readTextFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should read file contents from a path', async () => {
    mockTextContent('file contents');

    const content = await readTextFile('/path/to/file.txt');

    expect(content).toBe('file contents');
    expect(tauriReadTextFile).toHaveBeenCalledWith('/path/to/file.txt');
  });

  it('should throw descriptive error on read failure', async () => {
    vi.mocked(tauriReadTextFile).mockRejectedValue(new Error('Permission denied'));

    await expect(readTextFile('/path/to/protected.txt')).rejects.toThrow('Failed to read file');
  });

  it('should wrap non-Error rejections', async () => {
    vi.mocked(tauriReadTextFile).mockRejectedValue('some string error');

    await expect(readTextFile('/path/to/file.txt')).rejects.toThrow('Failed to read file');
  });
});

// ============================================================
// Tests — extractPdfText
// ============================================================

describe('extractPdfText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call the Rust extract_pdf_text command', async () => {
    mockPdfExtraction('Extracted PDF content');

    const text = await extractPdfText('/path/to/doc.pdf');

    expect(text).toBe('Extracted PDF content');
    expect(invoke).toHaveBeenCalledWith('extract_pdf_text', { path: '/path/to/doc.pdf' });
  });

  it('should throw descriptive error on command failure', async () => {
    mockPdfExtraction(new Error('Corrupt PDF file'));

    await expect(extractPdfText('/path/to/bad.pdf')).rejects.toThrow('PDF extraction failed');
  });

  it('should wrap non-Error rejections from the command', async () => {
    vi.mocked(invoke).mockRejectedValue('Rust panic');

    await expect(extractPdfText('/path/to/bad.pdf')).rejects.toThrow('PDF extraction failed');
  });
});
