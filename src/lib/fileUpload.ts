import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile as tauriReadTextFile, stat } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_EXTENSIONS = ['txt', 'md', 'pdf'];

/**
 * Opens a native file picker, validates the selected file, reads its content,
 * and returns text content with metadata.
 * Supports .txt and .md (read via Tauri fs) and .pdf (extracted via Rust command).
 *
 * @throws {Error} if no file selected, unsupported format, file too large, or extraction fails
 */
export async function uploadFile(): Promise<{ content: string; fileName: string; fileType: string }> {
  const selected = await open({
    title: 'Select a file',
    filters: [
      {
        name: 'Documents',
        extensions: SUPPORTED_EXTENSIONS,
      },
    ],
    multiple: false,
  });

  if (!selected) {
    throw new Error('No file selected');
  }

  const filePath = selected as string;
  const fileName = filePath.split(/[/\\]/).pop() || 'unknown';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Unsupported file format: .${ext}. Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}`
    );
  }

  // Validate file size before reading
  const fileInfo = await stat(filePath);
  if (fileInfo.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    );
  }

  let content: string;

  if (ext === 'pdf') {
    content = await extractPdfText(filePath);
    // Detect scanned/image-only PDFs (text extraction returns empty/whitespace)
    if (!content.trim()) {
      throw new Error(
        'PDF appears to be image-only or scanned. Text extraction requires text-layer PDFs.'
      );
    }
  } else {
    content = await readTextFile(filePath);
  }

  return { content, fileName, fileType: ext };
}

/**
 * Reads a text file from the given path using the Tauri filesystem API.
 *
 * @throws {Error} with descriptive message on read failure
 */
export async function readTextFile(path: string): Promise<string> {
  try {
    return await tauriReadTextFile(path);
  } catch (error) {
    throw new Error(`Failed to read file: ${error}`);
  }
}

/**
 * Extracts text from a PDF file at the given path by calling the Rust backend command.
 * Only works with text-layer PDFs — scanned/image-only PDFs will return empty text.
 *
 * @throws {Error} with descriptive message on extraction failure
 */
export async function extractPdfText(path: string): Promise<string> {
  try {
    const text: string = await invoke('extract_pdf_text', { path });
    return text;
  } catch (error) {
    throw new Error(`PDF extraction failed: ${error}`);
  }
}
