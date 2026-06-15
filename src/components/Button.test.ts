import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Button from './Button.svelte';

describe('Button', () => {
  // ── 1. Renders default variant and size classes ────────────────────
  it('renders with default variant and size classes', () => {
    render(Button);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-primary');
    expect(btn.className).toContain('px-4 py-2 text-sm');
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  // ── 2. All 5 variants render correct classes ───────────────────────
  it.each([
    ['default', 'bg-primary'],
    ['outline', 'border-border'],
    ['ghost', 'bg-transparent'],
    ['destructive', 'bg-destructive'],
    ['secondary', 'bg-secondary'],
  ] as const)('renders variant %s with correct classes', (variant, expectedClass) => {
    render(Button, { variant });
    expect(screen.getByRole('button').className).toContain(expectedClass);
  });

  // ── 3. All 3 sizes render correct classes ──────────────────────────
  it.each([
    ['sm', 'px-3 py-1.5 text-xs'],
    ['md', 'px-4 py-2 text-sm'],
    ['lg', 'px-6 py-2.5 text-base'],
  ] as const)('renders size %s with correct classes', (size, expectedClass) => {
    render(Button, { size });
    const btn = screen.getByRole('button');
    expectedClass.split(' ').forEach((cls) => expect(btn.className).toContain(cls));
  });

  // ── 4. Disabled state ──────────────────────────────────────────────
  it('renders disabled attribute when disabled=true', () => {
    render(Button, { disabled: true });
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  // ── 5. Click handler fires when enabled ────────────────────────────
  it('calls onclick when clicked', async () => {
    const onClick = vi.fn();
    render(Button, { onclick: onClick });
    await fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // ── 7. Type attribute defaults to button ───────────────────────────
  it('has type="button" by default', () => {
    render(Button);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });

  // ── 8. Custom type attribute ───────────────────────────────────────
  it('accepts custom type attribute', () => {
    render(Button, { type: 'submit' });
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit');
  });

  // ── 9. Custom class is merged ──────────────────────────────────────
  it('merges custom className', () => {
    render(Button, { class: 'my-custom' });
    expect(screen.getByRole('button').className).toContain('my-custom');
  });
});
