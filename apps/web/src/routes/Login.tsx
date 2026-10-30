import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Button, Field, Input } from '../design-system/ui';
import { useLogin } from '../lib/queries';
import { ApiError } from '../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    setError(null);
    login.mutate(
      { email, password },
      {
        onSuccess: () => navigate('/app', { replace: true }),
        onError: (mutationError) =>
          setError(
            mutationError instanceof ApiError
              ? mutationError.message
              : 'Sign-in failed. Check the server connection.',
          ),
      },
    );
  };

  return (
    <AuthLayout
      title="Sign in to the core."
      description="Credentials are verified against the local database. Failed attempts are rate limited and audited."
      aside={
        <div className="mt-8 border-t border-hairline pt-5 text-[11.5px] leading-relaxed text-dim">
          If you have lost the owner password, stop the server and run the recovery script documented
          in <span className="text-mute">docs/12-operations/troubleshooting.md</span>. It
          requires filesystem access to this machine; there is no remote reset.
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-[5px] border border-danger/30 bg-danger/[0.07] px-3 py-2.5 text-[12.5px] leading-relaxed text-danger"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {error}
          </div>
        ) : null}

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={login.isPending}>
          Enter console
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </form>
    </AuthLayout>
  );
}
