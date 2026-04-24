import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Code2, Hammer, ListChecks, User } from 'lucide-react';

export const metadata: Metadata = {
  title: 'AlgoForge',
  description: 'Kubernetes-native online judge',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link className="brand" href="/">
              <Code2 size={22} />
              AlgoForge
            </Link>
            <nav className="nav">
              <Link href="/problems">
                <ListChecks size={16} /> Problems
              </Link>
              <Link href="/admin/problems/new">
                <Hammer size={16} /> Admin
              </Link>
              <Link href="/profile">
                <User size={16} /> Profile
              </Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
