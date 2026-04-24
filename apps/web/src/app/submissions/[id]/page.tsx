import { api } from '@/lib/api';

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { submission } = await api.getSubmission(id);

  return (
    <main className="page">
      <section className="panel" style={{ padding: 16 }}>
        <h1>{submission.problem.title}</h1>
        <p>
          {submission.language.name} · {submission.status} · {submission.passedTests}/{submission.totalTests}
        </p>
        <pre className="pre">{submission.sourceCode}</pre>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Testcase</th>
              <th>Status</th>
              <th>Time</th>
              <th>Output</th>
            </tr>
          </thead>
          <tbody>
            {submission.jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.testcase.name}</td>
                <td>{job.result?.verdict ?? job.status}</td>
                <td>{job.result?.wallTimeMs ?? 0}ms</td>
                <td>
                  <pre className="pre">{job.result?.stdout ?? ''}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
