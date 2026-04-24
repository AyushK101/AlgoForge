import Link from 'next/link';
import { ArrowRight, TerminalSquare } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="page">
      <section className="panel" style={{ padding: 24 }}>
        <div className="stack">
          <TerminalSquare size={32} />
          <h1 style={{ margin: 0, fontSize: 40 }}>AlgoForge Judge Workspace</h1>
          <p className="muted" style={{ maxWidth: 720 }}>
            A local-first online judge rewrite with a dedicated API, async execution queue, autoscaled workers, and
            gVisor-ready sandbox runtime images.
          </p>
          <div>
            <Link className="button primary" href="/problems">
              Open problems <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
