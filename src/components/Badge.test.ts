import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Badge from './Badge.svelte';

describe('Badge', () => {
  // ── 1. Renders text ────────────────────────────────────────────────
  it('renders the text prop', () => {
    render(Badge, { text: 'Active' });
    expect(screen.getByText('Active')).toBeTruthy();
  });

  // ── 2. Default variant classes ─────────────────────────────────────
  it('applies default variant classes', () => {
    render(Badge, { text: 'Default' });
    const badge = screen.getByText('Default');
    expect(badge.className).toContain('border-border');
    expect(badge.className).toContain('text-muted-foreground');
  });

  // ── 3. Success variant classes ─────────────────────────────────────
  it('applies success variant class', () => {
    render(Badge, { text: 'Done', variant: 'success' });
    expect(screen.getByText('Done').className).toContain('text-success');
  });

  // ── 4. Warning variant classes ─────────────────────────────────────
  it('applies warning variant class', () => {
    render(Badge, { text: 'Pending', variant: 'warning' });
    expect(screen.getByText('Pending').className).toContain('text-warning');
  });

  // ── 5. Destructive variant classes ─────────────────────────────────
  it('applies destructive variant class', () => {
    render(Badge, { text: 'Error', variant: 'destructive' });
    expect(screen.getByText('Error').className).toContain('text-destructive');
  });

  // ── 6. Accent variant ──────────────────────────────────────────────
  it('applies accent variant class', () => {
    render(Badge, { text: 'New', variant: 'accent' });
    expect(screen.getByText('New').className).toContain('text-accent');
  });

  // ── 7. Primary variant ─────────────────────────────────────────────
  it('applies primary variant class', () => {
    render(Badge, { text: 'Featured', variant: 'primary' });
    expect(screen.getByText('Featured').className).toContain('text-primary');
  });

  // ── 8. Custom class is merged ──────────────────────────────────────
  it('merges custom className', () => {
    render(Badge, { text: 'Custom', class: 'my-class' });
    expect(screen.getByText('Custom').className).toContain('my-class');
  });
});
