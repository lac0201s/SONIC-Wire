/**
 * Break-glass owner password recovery.
 *
 * SonicWire has exactly one owner account and no email delivery, so there is no
 * remote "forgot password" flow to attack. Recovery therefore requires what an
 * attacker would need anyway: filesystem access to the database. This command
 * rewrites the owner's password hash, invalidates every session, and writes an
 * audit entry so the change is visible in the observatory.
 *
 * Usage (from apps/server, after stopping the API):
 *   npm run owner:reset --workspace @sonicwire/server
 *   npm run owner:reset --workspace @sonicwire/server -- --email owner@example.com
 *
 * The password is read from the terminal with echo disabled; when stdin is not
 * a TTY the first line is used, which supports scripted recovery.
 */
import { stdin as input, stdout as output } from 'node:process';
import readline from 'node:readline';
import { config } from '../config.js';
import { openDatabase, execute, queryAll, queryOne, nowIso } from '../db/index.js';
import { hashPassword } from '../modules/auth/service.js';
import path from 'node:path';

const MIN_LENGTH = 12;

/**
 * Reads one hidden password from an interactive terminal. Echo is suppressed by
 * muting readline's output writer, which is the standard Node approach; the
 * prompt itself is printed before the interface is created so it survives the
 * mute.
 */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    output.write(question);
    const rl = readline.createInterface({ input, output, terminal: true });
    const shim = rl as unknown as { _writeToOutput?: (value: string) => void };
    const original = shim._writeToOutput?.bind(rl);
    shim._writeToOutput = (value: string) => {
      if (value === '\n' || value === '\r\n') output.write('\n');
    };
    rl.question('', (answer) => {
      if (original) shim._writeToOutput = original;
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Reads piped input. A single readline interface collects every line, because
 * closing one interface ends stdin for the next one in Node.
 */
function readPipedLines(count: number): Promise<string[]> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input, terminal: false });
    const lines: string[] = [];
    rl.on('line', (line) => {
      lines.push(line);
      if (lines.length >= count) {
        rl.close();
        resolve(lines);
      }
    });
    rl.on('close', () => resolve(lines));
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const emailIndex = args.indexOf('--email');
  const email = emailIndex >= 0 ? args[emailIndex + 1] : undefined;

  const dbPath = path.join(config.DATA_DIR, 'sonicwire.db');
  console.log(`SonicWire owner recovery`);
  console.log(`Database: ${dbPath}`);

  const db = openDatabase(dbPath);
  try {
    const owners = queryAll<{ id: string; email: string }>(
      db,
      'SELECT id, email FROM users ORDER BY created_at LIMIT 5',
    );
    if (owners.length === 0) {
      console.error('No owner exists yet. Complete first-run setup in the browser instead.');
      process.exitCode = 2;
      return;
    }
    const target = email ? owners.find((owner) => owner.email === email) : owners[0];
    if (!target) {
      console.error(`No account matches ${email}. Existing accounts: ${owners.map((o) => o.email).join(', ')}`);
      process.exitCode = 2;
      return;
    }

    let password: string;
    let confirm: string;
    if (input.isTTY) {
      password = await promptHidden(`New password for ${target.email} (hidden): `);
      confirm = await promptHidden('Repeat password: ');
    } else {
      const lines = await readPipedLines(2);
      password = lines[0] ?? '';
      confirm = lines[1] ?? '';
      if (lines.length < 2) {
        console.error('Expected two lines on stdin: the new password, then the same password again.');
        process.exitCode = 2;
        return;
      }
    }
    if (password.length < MIN_LENGTH) {
      console.error(`Password must be at least ${MIN_LENGTH} characters.`);
      process.exitCode = 2;
      return;
    }
    if (confirm !== password) {
      console.error('Passwords did not match. Nothing was changed.');
      process.exitCode = 2;
      return;
    }

    execute(db, 'UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(password), target.id);
    const sessions = execute(db, 'DELETE FROM sessions WHERE user_id = ?', target.id);
    const workspace = queryOne<{ id: string }>(db, 'SELECT id FROM workspaces LIMIT 1');
    execute(
      db,
      `INSERT INTO audit_events (id, workspace_id, actor_id, action, target_type, target_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      `audit_${Date.now().toString(36)}`,
      workspace?.id ?? null,
      target.id,
      'auth.owner_password_reset',
      'user',
      target.id,
      JSON.stringify({ channel: 'cli', sessionsInvalidated: sessions }),
      nowIso(),
    );

    console.log(
      `Password updated for ${target.email}. ${sessions} session(s) invalidated. Start the API and sign in.`,
    );
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
