import Link from 'next/link';
import { api } from '@/lib/api';

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
      <form className="toolbar">
        <input className="input" name="search" placeholder="Search problems" defaultValue={params.search} />
        <select className="input" name="difficulty" defaultValue={params.difficulty ?? ''}>
          <option value="">Any difficulty</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
        <input className="input" name="tag" placeholder="Tag" defaultValue={params.tag} />
        <button className="button primary" type="submit">
          Filter
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
                <td>
                  <Link href={`/problems/${problem.slug}`}>{problem.title}</Link>
                  <div className="muted">{problem.slug}</div>
                </td>
                <td>{problem.difficulty}</td>
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
