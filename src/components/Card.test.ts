import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Card from './Card.svelte';

describe('Card', () => {
  // ── 1. Renders title ───────────────────────────────────────────────
  it('renders title as h3', () => {
    render(Card, { title: 'My Card' });
    expect(screen.getByRole('heading', { level: 3, name: 'My Card' })).toBeTruthy();
  });

  // ── 2. Renders eyebrow ─────────────────────────────────────────────
  it('renders eyebrow text', () => {
    render(Card, { title: 'Card', eyebrow: 'OVERVIEW' });
    expect(screen.getByText('OVERVIEW')).toBeTruthy();
  });

  // ── 3. Eyebrow appears before title ────────────────────────────────
  it('renders eyebrow before title', () => {
    render(Card, { eyebrow: 'ABOVE', title: 'Below' });
    const section = document.querySelector('section');
    const header = section?.querySelector('header');
    const children = header?.children;
    expect(children?.[0]?.textContent).toBe('ABOVE');
    expect(children?.[1]?.textContent).toBe('Below');
  });

  // ── 4. Default padding is md (p-5) ─────────────────────────────────
  it('applies default md padding', () => {
    render(Card);
    const section = document.querySelector('section');
    expect(section?.className).toContain('p-5');
  });

  // ── 5. Padding variants ────────────────────────────────────────────
  it.each([
    ['sm', 'p-3'],
    ['md', 'p-5'],
    ['lg', 'p-8'],
  ] as const)('applies padding %s class', (padding, expectedClass) => {
    render(Card, { padding, children: () => 'Content' });
    const section = document.querySelector('section');
    expect(section?.className).toContain(expectedClass);
  });

  // ── 6. Padding "none" removes padding class ────────────────────────
  it('applies no padding class for padding="none"', () => {
    render(Card, { padding: 'none', children: () => 'Content' });
    const section = document.querySelector('section');
    expect(section?.className).not.toContain('p-3');
    expect(section?.className).not.toContain('p-5');
    expect(section?.className).not.toContain('p-8');
  });

  // ── 7. Custom class is merged ──────────────────────────────────────
  it('merges custom className', () => {
    render(Card, { class: 'my-card' });
    expect(document.querySelector('section')?.className).toContain('my-card');
  });

  // ── 8. No title or eyebrow = no header ─────────────────────────────
  it('does not render header when no title or eyebrow', () => {
    render(Card);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(document.querySelector('header')).toBeNull();
  });

  // ── 9. Renders empty section without any props ─────────────────────
  it('renders empty section without props', () => {
    render(Card);
    const section = document.querySelector('section');
    expect(section).toBeTruthy();
    expect(section?.className).toContain('surface-card');
  });
});
