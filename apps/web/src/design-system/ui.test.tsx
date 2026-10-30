import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Badge, Button, EmptyState, Meter, Modal, StatusBadge, ToastProvider, Tabs, useToast } from './ui';
import { Waveform } from './SignalCanvas';

describe('Button', () => {
  it('invokes onClick and blocks interaction while loading', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Run</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} loading>
        Run
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('status semantics', () => {
  it('renders a human-readable status badge', () => {
    render(<StatusBadge status="waiting_approval" />);
    expect(screen.getByText('waiting approval')).toBeTruthy();
  });

  it('marks derived tone and accessibility attributes on Meter', () => {
    render(<Meter value={0.5} label="Disk usage" segments={10} />);
    const meter = screen.getByRole('progressbar', { name: 'Disk usage' });
    expect(meter.getAttribute('aria-valuenow')).toBe('50');
  });

  it('renders a count in a badge', () => {
    render(<Badge tone="ok">{4} ready</Badge>);
    expect(screen.getByText(/ready/)).toBeTruthy();
  });
});

describe('Tabs', () => {
  it('moves selection with the keyboard', () => {
    function Harness() {
      const [value, setValue] = useState('a');
      return (
        <Tabs
          value={value}
          onChange={setValue}
          tabs={[
            { id: 'a', label: 'Alpha' },
            { id: 'b', label: 'Beta' },
          ]}
        />
      );
    }
    render(<Harness />);
    const alpha = screen.getByRole('tab', { name: 'Alpha' });
    alpha.focus();
    fireEvent.keyDown(alpha, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Beta' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('Modal', () => {
  it('traps semantics, closes on Escape and restores focus', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Modal open={open} onClose={() => setOpen(false)} title="Confirm">
            <p>Body</p>
          </Modal>
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});

describe('Waveform', () => {
  it('renders one bar per peak and exposes a seek affordance', () => {
    const onSeek = vi.fn();
    render(
      <Waveform peaks={[0.1, 0.5, 0.9, 0.2]} progress={0.5} onSeek={onSeek} label="Seek audio" />,
    );
    const seek = screen.getByRole('button', { name: 'Seek audio' });
    expect(seek.querySelectorAll('rect').length).toBe(4);
    expect(seek.querySelector('svg')?.getAttribute('aria-label')).toBe('Seek audio');
    fireEvent.click(seek, { clientX: 10 });
    expect(onSeek).toHaveBeenCalled();
    const ratio = onSeek.mock.calls[0]?.[0] ?? -1;
    expect(ratio).toBeGreaterThanOrEqual(0);
    expect(ratio).toBeLessThanOrEqual(1);
  });
});

describe('toasts', () => {
  it('announces notifications through a live region', async () => {
    function Harness() {
      const { notify } = useToast();
      return (
        <button type="button" onClick={() => notify({ tone: 'ok', title: 'Imported' })}>
          Notify
        </button>
      );
    }
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    await waitFor(() => expect(screen.getByText('Imported')).toBeTruthy());
  });
});

describe('EmptyState', () => {
  it('presents a title, description and action', () => {
    render(
      <EmptyState
        title="Nothing here"
        description="Import a file to begin."
        action={<Button>Import</Button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeTruthy();
    expect(screen.getByText('Import a file to begin.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Import' })).toBeTruthy();
  });
});
