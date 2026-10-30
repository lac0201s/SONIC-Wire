import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AssetSummary } from '@sonicwire/contracts';
import { AssetCard, AssetRow } from './AssetCard';

const asset: AssetSummary = {
  id: 'asset-1',
  title: 'Night shoot — camera A',
  kind: 'video',
  status: 'ready',
  mimeType: 'video/mp4',
  sizeBytes: 24 * 1024 * 1024,
  durationMs: 90_000,
  width: 1920,
  height: 1080,
  videoCodec: 'h264',
  audioCodec: 'aac',
  container: 'MP4',
  bitRate: 2_000_000,
  sha256: 'f'.repeat(64),
  sourceKind: 'upload',
  sourceUrl: null,
  acquiredAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  hasThumbnail: false,
  hasWaveform: false,
  parentAssetId: null,
  version: 1,
  tags: ['rushes'],
  collectionIds: [],
  errorMessage: null,
};

const renderCard = (props: Partial<Parameters<typeof AssetCard>[0]> = {}) =>
  render(
    <MemoryRouter>
      <AssetCard asset={asset} {...props} />
    </MemoryRouter>,
  );

describe('AssetCard', () => {
  it('shows title, duration and codec facts', () => {
    renderCard();
    expect(screen.getByText('Night shoot — camera A')).toBeTruthy();
    expect(screen.getByText('1:30')).toBeTruthy();
    expect(screen.getByText('h264')).toBeTruthy();
    expect(screen.getByText('1080p')).toBeTruthy();
  });

  it('links to the inspector and toggles selection without navigating', () => {
    const onToggle = vi.fn();
    renderCard({ selectable: true, selected: false, onToggle });
    const checkbox = screen.getByRole('button', { name: 'Select Night shoot — camera A' });
    expect(checkbox.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith('asset-1');
    expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(2);
  });

  it('surfaces non-ready states', () => {
    render(
      <MemoryRouter>
        <AssetCard asset={{ ...asset, status: 'error', errorMessage: 'decode failed' }} />
      </MemoryRouter>,
    );
    expect(screen.getByText('error')).toBeTruthy();
  });

  it('renders a list row with compact telemetry', () => {
    render(
      <MemoryRouter>
        <AssetRow asset={asset} />
      </MemoryRouter>,
    );
    expect(screen.getByText('video · upload')).toBeTruthy();
    expect(screen.getByText('1:30')).toBeTruthy();
  });
});
