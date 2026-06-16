import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile as tauriReadTextFile, stat } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { createApiError, ErrorCodes, classifyError } from './errorUtils';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_EXTENSIONS = ['txt', 'md', 'pdf'];

/**
 * Opens a native file picker, validates the selected file, reads its content,
 * and returns text content with metadata.
 * Supports .txt and .md (read via Tauri fs) and .pdf (extracted via Rust command).
 *
 * @throws {ApiError} with descriptive code+message on any failure
 */
export async function uploadFile(): Promise<{ content: string; fileName: string; fileType: string }> {
  // Guard: ensure we're running inside Tauri webview (not plain browser dev server)
  if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) {
    throw new Error(
      'File upload requires the Tauri desktop app. Please run `npm run tauri dev` instead of `npm run dev`.'
    );
  }

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
    throw createApiError(
      ErrorCodes.FILE_NO_FILE_SELECTED,
      'No file selected'
    );
  }

  const filePath = selected as string;
  const fileName = filePath.split(/[/\\]/).pop() || 'unknown';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw createApiError(
      ErrorCodes.FILE_UNSUPPORTED_FORMAT,
      `Unsupported file format: .${ext}. Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}`
    );
  }

  // Validate file size before reading
  try {
    const fileInfo = await stat(filePath);
    if (fileInfo.size > MAX_FILE_SIZE) {
      throw createApiError(
        ErrorCodes.FILE_TOO_LARGE,
        `File size exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      );
    }
  } catch (error: unknown) {
    // If it's already an ApiError (like our FILE_TOO_LARGE), rethrow
    if (typeof error === 'object' && error !== null && 'code' in error) {
      throw error;
    }
    // File stat failed — wrap into a typed error
    const apiErr = classifyError(error, 'FileStat');
    throw apiErr.code === ErrorCodes.UNKNOWN_ERROR
      ? createApiError(ErrorCodes.FILE_NOT_FOUND, `Cannot access file: ${fileName}`)
      : apiErr;
  }

  let content: string;

  if (ext === 'pdf') {
    content = await extractPdfText(filePath);
    // Detect scanned/image-only PDFs (text extraction returns empty/whitespace)
    if (!content.trim()) {
      throw createApiError(
        ErrorCodes.FILE_CORRUPTED_PDF,
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
 * @throws {ApiError} with FILE_READ_ERROR code on read failure
 */
export async function readTextFile(path: string): Promise<string> {
  try {
    return await tauriReadTextFile(path);
  } catch (error) {
    throw createApiError(
      ErrorCodes.FILE_READ_ERROR,
      `Failed to read file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Extracts text from a PDF file at the given path by calling the Rust backend command.
 * Only works with text-layer PDFs — scanned/image-only PDFs will return empty text.
 *
 * @throws {ApiError} with FILE_CORRUPTED_PDF code on extraction failure
 */
export async function extractPdfText(path: string): Promise<string> {
  try {
    const text: string = await invoke('extract_pdf_text', { path });
    return text;
  } catch (error) {
    throw createApiError(
      ErrorCodes.FILE_CORRUPTED_PDF,
      `PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
