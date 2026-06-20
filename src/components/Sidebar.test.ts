import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Sidebar from './Sidebar.svelte';

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn().mockResolvedValue('0.2.2'),
}));

describe('Sidebar', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    activeRoute: 'generate' as const,
    onnavigate: vi.fn(),
  };

  // ── 1. Renders all 4 nav items ─────────────────────────────────────
  it('renders all four navigation items', () => {
    render(Sidebar, defaultProps);
    expect(screen.getByTestId('nav-generate')).toBeTruthy();
    expect(screen.getByTestId('nav-take')).toBeTruthy();
    expect(screen.getByTestId('nav-history')).toBeTruthy();
    expect(screen.getByTestId('nav-settings')).toBeTruthy();
  });

  // ── 2. Nav items show correct labels ───────────────────────────────
  it('renders correct labels for each nav item', () => {
    render(Sidebar, defaultProps);
    expect(screen.getByText('Generate Test')).toBeTruthy();
    expect(screen.getByText('Take Test')).toBeTruthy();
    expect(screen.getByText('Test History')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  // ── 3. Active route has aria-current="page" ────────────────────────
  it('sets aria-current on the active route', () => {
    render(Sidebar, { activeRoute: 'history', onnavigate: vi.fn() });
    const generateBtn = screen.getByTestId('nav-generate');
    const historyBtn = screen.getByTestId('nav-history');

    expect(generateBtn.getAttribute('aria-current')).toBeNull();
    expect(historyBtn.getAttribute('aria-current')).toBe('page');
  });

  // ── 4. Active route has primary class ──────────────────────────────
  it('applies active class to current route', () => {
    render(Sidebar, { activeRoute: 'take', onnavigate: vi.fn() });
    const takeBtn = screen.getByTestId('nav-take');
    expect(takeBtn.className).toContain('bg-primary');
  });

  // ── 5. Calls onnavigate when a nav item is clicked ─────────────────
  it('calls onnavigate with correct route on click', async () => {
    const onnavigate = vi.fn();
    render(Sidebar, { activeRoute: 'generate', onnavigate });

    await fireEvent.click(screen.getByTestId('nav-settings'));
    expect(onnavigate).toHaveBeenCalledWith('settings');

    await fireEvent.click(screen.getByTestId('nav-history'));
    expect(onnavigate).toHaveBeenCalledWith('history');
  });

  // ── 6. Renders brand name ──────────────────────────────────────────
  it('renders the Pressey brand name', () => {
    render(Sidebar, defaultProps);
    expect(screen.getByText('Pressey')).toBeTruthy();
  });

  // ── 6b. Renders Logo component in the brand slot ──────────────────
  it('renders the Logo component in the brand area', () => {
    render(Sidebar, defaultProps);
    const logo = screen.getByRole('img', { name: 'Pressey logo' });
    expect(logo).toBeTruthy();
    expect(logo.tagName.toLowerCase()).toBe('svg');
  });

  // ── 6c. Logo carries role="img" and aria-label ─────────────────────
  it('exposes role="img" and aria-label on the logo', () => {
    render(Sidebar, defaultProps);
    const logo = screen.getByRole('img', { name: 'Pressey logo' });
    expect(logo.getAttribute('role')).toBe('img');
    expect(logo.getAttribute('aria-label')).toBe('Pressey logo');
  });

  // ── 7. Renders version status strip ────────────────────────────────
  it('renders version status', async () => {
    render(Sidebar, defaultProps);
    expect(await screen.findByText('v0.2.2 · local')).toBeTruthy();
  });

  // ── 8. Renders nav descriptions ────────────────────────────────────
  it('shows descriptions for nav items', () => {
    render(Sidebar, defaultProps);
    expect(screen.getByText('AI-authored questions')).toBeTruthy();
    expect(screen.getByText('Run a saved test')).toBeTruthy();
    expect(screen.getByText('Past runs & attempts')).toBeTruthy();
    expect(screen.getByText('API & preferences')).toBeTruthy();
  });

  // ── 9. Workspace label is present ──────────────────────────────────
  it('renders the Workspace section label', () => {
    render(Sidebar, defaultProps);
    expect(screen.getByText('Workspace')).toBeTruthy();
  });
});
