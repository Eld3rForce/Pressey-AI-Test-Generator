import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Logo from './Logo.svelte';

describe('Logo', () => {
  // ── 1. Accessibility — role and aria-label ──────────────────────────
  it('renders with role="img" and aria-label="Pressey logo"', () => {
    render(Logo);
    const logo = screen.getByRole('img', { name: 'Pressey logo' });
    expect(logo).toBeTruthy();
    expect(logo.getAttribute('aria-label')).toBe('Pressey logo');
  });

  // ── 2. viewBox is set for responsive scaling ────────────────────────
  it('has viewBox="0 0 100 100"', () => {
    render(Logo);
    const logo = screen.getByRole('img', { name: 'Pressey logo' });
    expect(logo.getAttribute('viewBox')).toBe('0 0 100 100');
  });

  // ── 3. Default size is 40 (matches sidebar brand slot) ──────────────
  it('uses default size of 40', () => {
    render(Logo);
    const logo = screen.getByRole('img', { name: 'Pressey logo' }) as SVGElement;
    expect(logo.getAttribute('width')).toBe('40');
    expect(logo.getAttribute('height')).toBe('40');
  });

  // ── 4. Custom size prop is forwarded to width/height ────────────────
  it('accepts a custom size prop', () => {
    render(Logo, { size: 64 });
    const logo = screen.getByRole('img', { name: 'Pressey logo' }) as SVGElement;
    expect(logo.getAttribute('width')).toBe('64');
    expect(logo.getAttribute('height')).toBe('64');
  });

  // ── 5. Custom className is merged (preserves shrink-0) ──────────────
  it('merges custom className', () => {
    render(Logo, { class: 'text-primary' });
    const logo = screen.getByRole('img', { name: 'Pressey logo' });
    expect(logo.className.baseVal).toContain('shrink-0');
    expect(logo.className.baseVal).toContain('text-primary');
  });

  // ── 6. Uses theme CSS variables (no hardcoded colors) ───────────────
  it('references theme CSS variables for all colors', () => {
    const { container } = render(Logo);
    const html = container.innerHTML;
    expect(html).toContain('var(--color-primary)');
    expect(html).toContain('var(--color-foreground)');
    expect(html).toContain('var(--color-background)');
  });

  // ── 7. Single root SVG element ──────────────────────────────────────
  it('renders exactly one root svg element', () => {
    const { container } = render(Logo);
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(1);
  });

  // ── 8. Renders the three composition layers (pencil, head, cap) ────
  it('contains the pencil group, head fill, and cap elements', () => {
    const { container } = render(Logo);
    const svg = container.querySelector('svg')!;
    // Pencil uses <g> with a rotation transform
    expect(svg.querySelector('g[transform*="rotate"]')).toBeTruthy();
    // Head: 1 base path + 2 ear paths + 2 eye-band paths + 2 eye circles + 1 nose = 8 fill shapes
    // Cap: 1 headband path + 2 polygons (fill + stroke) + 1 button circle = 4 shapes
    // Tassel: 1 path + 1 circle + 1 fringe path = 3 shapes
    // Plus 1 ferrule line = 1 element. Total >= 16.
    expect(svg.children.length).toBeGreaterThanOrEqual(15);
  });
});
