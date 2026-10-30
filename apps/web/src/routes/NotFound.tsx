import { Link } from 'react-router-dom';
import { Mark } from '../design-system/Brand';
import { Button, Label } from '../design-system/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Mark className="text-ember" />
      <h1 className="max-w-md text-[28px] leading-tight font-semibold tracking-[-0.03em]">
        That path is not wired to anything.
      </h1>
      <p className="max-w-sm text-[13px] leading-relaxed text-mute">
        The link may be stale. Return to the console or the public capability overview.
      </p>
      <div className="mt-2 flex gap-3">
        <Link to="/app">
          <Button variant="primary">Open console</Button>
        </Link>
        <Link to="/">
          <Button variant="outline">Public site</Button>
        </Link>
      </div>
    </div>
  );
}
