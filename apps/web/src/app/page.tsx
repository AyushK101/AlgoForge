import Link from 'next/link';
import { ArrowRight, TerminalSquare, Cpu, Globe, Shield } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="page">
      <section style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="stack flex items-center justify-center" style={{ alignItems: 'center', gap: 24 }}>
          <div
            style={{
              background: 'var(--accents-1)',
              border: '1px solid var(--accents-2)',
              borderRadius: '999px',
              padding: '8px 16px',
              fontSize: '0.875rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--accents-6)',
            }}
          >
            <span style={{ color: 'var(--geist-success)' }}>●</span> Introducing AlgoForge V2
          </div>
          <h1 style={{ margin: 0, fontSize: 64, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1 }}>
            The Kubernetes-Native <br />
            <span style={{ color: 'var(--accents-5)' }}>Online Judge.</span>
          </h1>
          <p className="muted flex " style={{ maxWidth: 640, fontSize: '1.25rem', lineHeight: 1.6 }}>
            A local-first online judge rewrite with a dedicated API, async execution queue, autoscaled workers, and
            gVisor-ready sandbox runtime images.
          </p>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <Link className="button primary" href="/problems">
              Get Started <ArrowRight size={16} />
            </Link>
            <Link className="button" href="https://github.com">
              View Documentation
            </Link>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginTop: 64 }}>
        <div className="panel" style={{ padding: 32 }}>
          <div className="stack" style={{ gap: 16 }}>
            <Cpu size={32} />
            <h3 style={{ margin: 0 }}>Autoscaled Workers</h3>
            <p className="muted" style={{ margin: 0 }}>
              KEDA-powered autoscaling ensures your submissions are processed instantly, regardless of load.
            </p>
          </div>
        </div>
        <div className="panel" style={{ padding: 32 }}>
          <div className="stack" style={{ gap: 16 }}>
            <Shield size={32} />
            <h3 style={{ margin: 0 }}>Secure Sandboxing</h3>
            <p className="muted" style={{ margin: 0 }}>
              Hardened gVisor runtime pods provide strong isolation for untrusted code execution.
            </p>
          </div>
        </div>
        <div className="panel" style={{ padding: 32 }}>
          <div className="stack" style={{ gap: 16 }}>
            <Globe size={32} />
            <h3 style={{ margin: 0 }}>K8s Native</h3>
            <p className="muted" style={{ margin: 0 }}>
              Built from the ground up to leverage the full power of the Kubernetes ecosystem.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
