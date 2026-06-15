import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Modal from './Modal.svelte';

describe('Modal', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Hidden when open is false ───────────────────────────────────
  it('does not render when open is false', () => {
    render(Modal, { open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // ── 2. Visible when open is true ───────────────────────────────────
  it('renders when open is true', () => {
    render(Modal, { open: true, title: 'Delete Item' });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Delete Item' })).toBeTruthy();
  });

  // ── 3. Renders title as h2 ─────────────────────────────────────────
  it('renders title as h2', () => {
    render(Modal, { open: true, title: 'My Title' });
    expect(screen.getByRole('heading', { level: 2, name: 'My Title' })).toBeTruthy();
  });

  // ── 4. Cancel button triggers oncancel ─────────────────────────────
  it('calls oncancel when Cancel button is clicked', async () => {
    const oncancel = vi.fn();
    render(Modal, { open: true, oncancel });
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(oncancel).toHaveBeenCalledTimes(1);
  });

  // ── 5. Confirm button triggers onconfirm ───────────────────────────
  it('calls onconfirm when Confirm button is clicked', async () => {
    const onconfirm = vi.fn();
    render(Modal, { open: true, onconfirm });
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onconfirm).toHaveBeenCalledTimes(1);
  });

  // ── 6. Custom button labels ────────────────────────────────────────
  it('uses custom button labels', () => {
    render(Modal, { open: true, confirmLabel: 'Yes', cancelLabel: 'No' });
    expect(screen.getByRole('button', { name: 'Yes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No' })).toBeTruthy();
  });

  // ── 7. Backdrop click calls oncancel ───────────────────────────────
  it('calls oncancel on backdrop click', async () => {
    const oncancel = vi.fn();
    render(Modal, { open: true, oncancel });
    const backdrop = screen.getByRole('dialog');
    await fireEvent.click(backdrop);
    expect(oncancel).toHaveBeenCalledTimes(1);
  });

  // ── 8. Content click does NOT close ────────────────────────────────
  it('does not close on content click', async () => {
    const oncancel = vi.fn();
    render(Modal, { open: true, oncancel, title: 'My Modal' });
    const heading = screen.getByRole('heading', { level: 2, name: 'My Modal' });
    await fireEvent.click(heading);
    expect(oncancel).not.toHaveBeenCalled();
  });

  // ── 9. Escape key closes modal ────────────────────────────────────
  it('closes on Escape key', async () => {
    const oncancel = vi.fn();
    render(Modal, { open: true, oncancel });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(oncancel).toHaveBeenCalledTimes(1);
  });

  // ── 10. Escape key does nothing when closed ────────────────────────
  it('does not react to Escape when closed', async () => {
    const oncancel = vi.fn();
    render(Modal, { open: false, oncancel });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(oncancel).not.toHaveBeenCalled();
  });
});
