import { api } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft, Clock, Code2, Cpu } from "lucide-react";

export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { submission } = await api.getSubmission(id);

  return (
    <main className="page">
      <div style={{ marginBottom: 32 }}>
        <Link
          href={`/problems/${submission.problem.slug}`}
          className="nav a"
          style={{ marginBottom: 16 }}
        >
          <ArrowLeft size={16} /> Back to problem
        </Link>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "2.5rem", fontWeight: 800 }}>
              Submission
            </h1>
            <p className="muted" style={{ margin: "8px 0 0 0" }}>
              {id}
            </p>
          </div>
          <div
            className="badge"
            style={{
              padding: "8px 16px",
              fontSize: "1rem",
              color: "var(--foreground)",
            }}
          >
            {submission.status}
          </div>
        </div>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}
      >
        <section className="stack">
          <div className="panel" style={{ padding: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <Code2 size={18} className="muted" />
              <h3 style={{ margin: 0 }}>Source Code</h3>
            </div>
            <pre className="pre" style={{ margin: 0 }}>
              {submission.sourceCode}
            </pre>
          </div>

          <div className="panel">
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid var(--accents-2)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Cpu size={18} className="muted" />
              <h3 style={{ margin: 0 }}>Test Results</h3>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Testcase</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Memory</th>
                </tr>
              </thead>
              <tbody>
                {submission.jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.testcase.name}</td>
                    <td>
                      <span
                        style={{
                          color:
                            job.result?.verdict === "ACCEPTED"
                              ? "var(--geist-success)"
                              : "var(--geist-error)",
                        }}
                      >
                        {job.result?.verdict ?? job.status}
                      </span>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Clock size={12} className="muted" />
                        {job.result?.wallTimeMs ?? 0}ms
                      </div>
                    </td>
                    <td>{job.result?.memoryKb ?? 0} KB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="stack">
          <div className="panel" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 16px 0" }}>Summary</h3>
            <div className="stack" style={{ gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Problem</span>
                <Link
                  href={`/problems/${submission.problem.slug}`}
                  style={{ color: "var(--foreground)" }}
                >
                  {submission.problem.title}
                </Link>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Language</span>
                <span>{submission.language.name}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Score</span>
                <span>
                  {submission.passedTests} / {submission.totalTests}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Submitted</span>
                <span>{new Date(submission.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
