import { describe, it, expect } from 'vitest';
import type { Snippet } from 'svelte';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Tooltip from './Tooltip.svelte';

describe('Tooltip', () => {
  // Helper: render a Tooltip wrapping a known trigger text so each test
  // can target the wrapper (parent of the role=tooltip element) and the
  // bubble unambiguously.
  const renderWithTrigger = (text = 'MCQ = Multiple Choice Questions') =>
    render(Tooltip, {
      text,
      children: (() => 'MCQ label') as unknown as Snippet,
    });

  // ── 1. Renders the tooltip text in a role="tooltip" element ─────
  it('renders the tooltip text inside a role="tooltip" element', () => {
    renderWithTrigger();
    const tip = screen.getByRole('tooltip');
    expect(tip).toBeTruthy();
    expect(tip.textContent).toContain('Multiple Choice');
  });

  // ── 2. aria-describedby on the wrapper points to the tooltip id ──
  it('sets aria-describedby on the trigger wrapper to the tooltip id', () => {
    renderWithTrigger();
    const tip = screen.getByRole('tooltip');
    const wrapper = tip.parentElement!;
    expect(wrapper.getAttribute('aria-describedby')).toBe(tip.id);
  });

  // ── 3. Wrapper is keyboard-focusable (tabindex=0) ────────────────
  it('makes the wrapper keyboard-focusable (tabindex="0")', () => {
    renderWithTrigger();
    const wrapper = screen.getByRole('tooltip').parentElement!;
    expect(wrapper.getAttribute('tabindex')).toBe('0');
  });

  // ── 4. Tooltip is hidden by default (data-visible="false") ───────
  it('hides the tooltip bubble by default (data-visible="false")', () => {
    renderWithTrigger();
    const wrapper = screen.getByRole('tooltip').parentElement!;
    expect(wrapper.getAttribute('data-visible')).toBe('false');
  });

  // ── 5. Tooltip becomes visible on hover (mouseenter) ────────────
  it('shows the tooltip on mouseenter and hides on mouseleave', async () => {
    renderWithTrigger();
    const wrapper = screen.getByRole('tooltip').parentElement!;
    await fireEvent.mouseEnter(wrapper);
    expect(wrapper.getAttribute('data-visible')).toBe('true');
    await fireEvent.mouseLeave(wrapper);
    expect(wrapper.getAttribute('data-visible')).toBe('false');
  });

  // ── 6. Tooltip becomes visible on focus (focusin) ───────────────
  it('shows the tooltip on focusin and hides on focusout', async () => {
    renderWithTrigger();
    const wrapper = screen.getByRole('tooltip').parentElement! as HTMLElement;
    wrapper.focus();
    await fireEvent.focusIn(wrapper);
    expect(wrapper.getAttribute('data-visible')).toBe('true');
    await fireEvent.focusOut(wrapper);
    expect(wrapper.getAttribute('data-visible')).toBe('false');
  });

  // ── 7. Visible on hover contains "Multiple Choice" text ─────────
  it('tooltip text contains "Multiple Choice" when shown via hover', async () => {
    renderWithTrigger();
    const wrapper = screen.getByRole('tooltip').parentElement!;
    await fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip').textContent).toContain('Multiple Choice');
  });

  // ── 8. Visible on focus contains "Multiple Choice" text ────────
  it('tooltip text contains "Multiple Choice" when shown via focus', async () => {
    renderWithTrigger();
    const wrapper = screen.getByRole('tooltip').parentElement! as HTMLElement;
    wrapper.focus();
    await fireEvent.focusIn(wrapper);
    expect(screen.getByRole('tooltip').textContent).toContain('Multiple Choice');
  });

  // ── 9. Custom class is merged into the wrapper ──────────────────
  it('merges a custom className onto the wrapper alongside tooltip-wrapper', () => {
    render(Tooltip, {
      text: 'X',
      class: 'my-trigger',
      children: (() => 'X') as unknown as Snippet,
    });
    const wrapper = screen.getByRole('tooltip').parentElement!;
    expect(wrapper.className).toContain('tooltip-wrapper');
    expect(wrapper.className).toContain('my-trigger');
  });

  // ── 10. Tooltip text exactly matches the `text` prop ────────────
  it('uses the `text` prop verbatim inside the bubble', () => {
    renderWithTrigger('MCQ = Multiple Choice Questions');
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent?.trim()).toBe('MCQ = Multiple Choice Questions');
  });
});
