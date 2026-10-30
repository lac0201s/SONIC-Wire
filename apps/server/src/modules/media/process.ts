import { spawn } from 'node:child_process';
import { AppError } from '../../http/errors.js';
import { logger } from '../../logger.js';

export interface RunOptions {
  cwd?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Hard cap on captured bytes per stream; excess is discarded, run continues. */
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
  onStdout?: (chunk: Buffer) => void;
  onStderrLine?: (line: string) => void;
  /** Additional cap for onStdout consumers that collect data. */
  env?: NodeJS.ProcessEnv;
}

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  killed: boolean;
  signal: NodeJS.Signals | null;
  durationMs: number;
}

const DEFAULT_MAX_OUTPUT = 4 * 1024 * 1024;

/**
 * Spawns a child process without a shell, in its own process group, so the
 * whole tree can be terminated on cancellation or timeout. Output capture is
 * bounded; callers needing large streams must consume via onStdout.
 */
export function runProcess(command: string, args: string[], options: RunOptions = {}): Promise<RunResult> {
  const started = Date.now();
  const maxStdout = options.maxStdoutBytes ?? DEFAULT_MAX_OUTPUT;
  const maxStderr = options.maxStderrBytes ?? DEFAULT_MAX_OUTPUT;

  return new Promise<RunResult>((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new AppError('conflict', 'Operation was cancelled before it started'));
      return;
    }

    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    let stdoutBytes = 0;
    let stderrBytes = 0;
    const stdoutChunks: Buffer[] = [];
    let stderrTail = '';
    let killed = false;
    let settled = false;

    const killTree = () => {
      if (killed || child.pid === undefined) return;
      killed = true;
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {
          /* process already gone */
        }
      }
    };

    const timeout = options.timeoutMs
      ? setTimeout(() => {
          logger.warn({ command, args: args.slice(0, 6) }, 'process timed out; killing tree');
          killTree();
        }, options.timeoutMs)
      : null;

    const onAbort = () => killTree();
    options.signal?.addEventListener('abort', onAbort, { once: true });

    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes <= maxStdout) {
        stdoutChunks.push(chunk);
      }
      options.onStdout?.(chunk);
    });

    let stderrBuffer = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrBytes += chunk.length;
      const text = chunk.toString('utf8');
      if (stderrBytes <= maxStderr) {
        stderrTail += text;
        if (stderrTail.length > maxStderr) stderrTail = stderrTail.slice(-maxStderr);
      }
      if (options.onStderrLine) {
        stderrBuffer += text;
        let newline = stderrBuffer.indexOf('\n');
        while (newline !== -1) {
          const line = stderrBuffer.slice(0, newline).trim();
          stderrBuffer = stderrBuffer.slice(newline + 1);
          if (line) options.onStderrLine(line);
          newline = stderrBuffer.indexOf('\n');
        }
        if (stderrBuffer.length > 8192) stderrBuffer = stderrBuffer.slice(-8192);
      }
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onAbort);
      reject(new AppError('internal', `Unable to start ${command}: ${error.message}`));
    });

    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onAbort);
      resolve({
        code,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: stderrTail,
        killed,
        signal,
        durationMs: Date.now() - started,
      });
    });
  });
}
