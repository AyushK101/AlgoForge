import Link from 'next/link';
import { api } from '@/lib/api';
import { Search, Filter } from 'lucide-react';

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; difficulty?: string; tag?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.difficulty) query.set('difficulty', params.difficulty);
  if (params.tag) query.set('tag', params.tag);
  const { problems } = await api.listProblems(query.size ? `?${query}` : '');

  return (
    <main className="page">
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0 0 8px 0' }}>Problems</h1>
        <p className="muted">Choose a problem to solve and test your skills.</p>
      </div>

      <form className="toolbar" style={{ borderRadius: 8, background: 'var(--accents-1)' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--accents-5)' }} />
          <input className="input" name="search" placeholder="Search problems..." defaultValue={params.search} style={{ paddingLeft: 40 }} />
        </div>
        <select className="input" name="difficulty" defaultValue={params.difficulty ?? ''} style={{ width: 160 }}>
          <option value="">Any difficulty</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
        <input className="input" name="tag" placeholder="Filter by tag..." defaultValue={params.tag} style={{ width: 160 }} />
        <button className="button primary" type="submit">
          <Filter size={16} /> Filter
        </button>
      </form>

      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Problem</th>
              <th>Difficulty</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {problems.map((problem) => (
              <tr key={problem.id}>
                <td style={{ width: '40%' }}>
                  <Link href={`/problems/${problem.slug}`} style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--foreground)' }}>
                    {problem.title}
                  </Link>
                  <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>{problem.slug}</div>
                </td>
                <td>
                  <span style={{ 
                    color: problem.difficulty === 'EASY' ? 'var(--geist-success)' : 
                           problem.difficulty === 'MEDIUM' ? 'var(--geist-warning)' : 
                           'var(--geist-error)',
                    fontWeight: 500
                  }}>
                    {problem.difficulty}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {problem.tags.map((tag) => (
                      <span className="badge" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
