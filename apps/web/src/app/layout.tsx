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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="shell">
          <header className="topbar">
            <Link className="brand" href="/">
              <Code2 size={24} strokeWidth={2.5} />
              <span>AlgoForge</span>
            </Link>
            <nav className="nav">
              <Link href="/problems">
                <ListChecks size={18} /> Problems
              </Link>
              <Link href="/admin/problems/new">
                <Hammer size={18} /> Admin
              </Link>
              <Link href="/profile">
                <User size={18} /> Profile
              </Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
