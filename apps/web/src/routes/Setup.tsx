import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Button, Field, Input, Label, Meter, cn } from '../design-system/ui';
import { useSetup } from '../lib/queries';
import { ApiError } from '../lib/api';

function passwordScore(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 10) score += 0.25;
  if (password.length >= 14) score += 0.15;
  if (password.length >= 20) score += 0.1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 0.2;
  if (/\d/.test(password)) score += 0.15;
  if (/[^A-Za-z0-9]/.test(password)) score += 0.15;
  const bounded = Math.min(1, score);
  const label =
    bounded >= 0.9 ? 'strong' : bounded >= 0.65 ? 'good' : bounded >= 0.4 ? 'fair' : 'weak';
  return { score: bounded, label };
}

export default function Setup() {
  const navigate = useNavigate();
  const setup = useSetup();
  const [form, setForm] = useState({
    displayName: '',
    workspaceName: 'My Workspace',
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const strength = passwordScore(form.password);

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    setError(null);
    if (form.password.length < 10) {
      setError('Use at least 10 characters for the owner password.');
      return;
    }
    setup.mutate(form, {
      onSuccess: () => navigate('/app', { replace: true }),
      onError: (mutationError) =>
        setError(
          mutationError instanceof ApiError
            ? mutationError.message
            : 'Initialisation failed. Check the server log.',
        ),
    });
  };

  return (
    <AuthLayout
      title="Create the owner account."
      description="SonicWire stores everything on this machine. The owner account controls the workspace, credentials and data deletion."
      aside={
        <div className="mt-8 space-y-3 border-t border-hairline pt-5">
          <div className="flex items-center gap-2 text-[11.5px] text-mute">
            <ShieldCheck className="size-3.5 text-ok" aria-hidden />
            Passwords are scrypt-hashed with a per-user salt
          </div>
          <div className="flex items-center gap-2 text-[11.5px] text-mute">
            <ShieldCheck className="size-3.5 text-ok" aria-hidden />
            No default credentials exist in this build
          </div>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="Your name" htmlFor="displayName">
          <Input
            id="displayName"
            autoComplete="name"
            required
            maxLength={80}
            value={form.displayName}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
            placeholder="Ada Lovelace"
          />
        </Field>
        <Field label="Workspace name" htmlFor="workspaceName">
          <Input
            id="workspaceName"
            required
            maxLength={80}
            value={form.workspaceName}
            onChange={(event) => setForm({ ...form, workspaceName: event.target.value })}
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="you@studio.local"
          />
        </Field>
        <Field
          label="Owner password"
          htmlFor="password"
          hint="Minimum 10 characters. Use a passphrase you can store safely."
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
        </Field>
        {form.password ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Password strength</Label>
              <span
                className={cn(
                  'text-[12.5px]',
                  strength.score >= 0.65 ? 'text-ok' : strength.score >= 0.4 ? 'text-warn' : 'text-danger',
                )}
              >
                {strength.label}
              </span>
            </div>
            <Meter
              value={strength.score}
              segments={18}
              tone={strength.score >= 0.65 ? 'ok' : strength.score >= 0.4 ? 'ember' : 'danger'}
              label="Password strength"
            />
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-[5px] border border-danger/30 bg-danger/[0.07] px-3 py-2.5 text-[12.5px] leading-relaxed text-danger"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {error}
          </div>
        ) : null}

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={setup.isPending}>
          Initialise SonicWire
          <ArrowRight className="size-4" aria-hidden />
        </Button>
        <p className="text-center text-[11.5px] leading-relaxed text-dim">
          Two starter workflows are created with the workspace. You can delete or extend them.
        </p>
      </form>
    </AuthLayout>
  );
}
