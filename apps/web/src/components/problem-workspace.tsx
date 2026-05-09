'use client';

import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Play, RefreshCw } from 'lucide-react';
import { api, type ProblemDetail } from '@/lib/api';

const starterCode = {
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    return 0;\n}\n',
  c: '#include <stdio.h>\n\nint main(void) {\n    return 0;\n}\n',
  java: 'public class Main {\n    public static void main(String[] args) {\n    }\n}\n',
  python: 'import sys\n\n',
};

export function ProblemWorkspace({ problem }: { problem: ProblemDetail }) {
  const [tab, setTab] = useState<'statement' | 'samples' | 'submissions'>('statement');
  const [language, setLanguage] = useState<'cpp' | 'c' | 'java' | 'python'>('cpp');
  const [sourceCode, setSourceCode] = useState(starterCode.cpp);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('IDLE');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setStatus('QUEUED');
    try {
      const result = await api.createSubmission({
        problemSlug: problem.slug,
        languageSlug: language,
        sourceCode,
      });
      setSubmissionId(result.submissionId);
      setStatus(result.status);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'SUBMIT_FAILED');
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    if (!submissionId) return;
    const result = await api.getSubmission(submissionId);
    setStatus(result.submission.status);
  }

  return (
    <main className="workspace">
      <section className="workspace-pane">
        <div className="tabs">
          <button
            className={`tab ${tab === 'statement' ? 'active' : ''}`}
            onClick={() => setTab('statement')}
          >
            Statement
          </button>
          <button
            className={`tab ${tab === 'samples' ? 'active' : ''}`}
            onClick={() => setTab('samples')}
          >
            Samples
          </button>
          <button
            className={`tab ${tab === 'submissions' ? 'active' : ''}`}
            onClick={() => setTab('submissions')}
          >
            Result
          </button>
        </div>

        {tab === 'statement' && (
          <article className="stack">
            <div>
              <span className="badge">{problem.difficulty}</span>
              <h1>{problem.title}</h1>
            </div>
            <p className="pre">{problem.statement}</p>
            <h3>Constraints</h3>
            <p className="pre">{problem.constraints || 'No extra constraints provided.'}</p>
          </article>
        )}

        {tab === 'samples' && (
          <div className="stack">
            {problem.testcases.map((testcase) => (
              <div className="panel" key={testcase.id} style={{ padding: 12 }}>
                <strong>{testcase.name}</strong>
                <p className="muted">Input</p>
                <pre className="pre">{testcase.input}</pre>
                <p className="muted">Expected output</p>
                <pre className="pre">{testcase.expectedOutput}</pre>
              </div>
            ))}
          </div>
        )}

        {tab === 'submissions' && (
          <div className="stack">
            <div className="panel" style={{ padding: 12 }}>
              <strong>Status</strong>
              <p>{status}</p>
              {submissionId && <p className="muted">Submission {submissionId}</p>}
            </div>
          </div>
        )}
      </section>

      <section className="workspace-pane" style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 12 }}>
        <div className="toolbar" style={{ margin: 0 }}>
          <select
            className="input"
            value={language}
            onChange={(event) => {
              const next = event.target.value as typeof language;
              setLanguage(next);
              setSourceCode(starterCode[next]);
            }}
          >
            <option value="cpp">C++20</option>
            <option value="c">C17</option>
            <option value="java">Java</option>
            <option value="python">Python 3</option>
          </select>
          <button className="button" onClick={refresh} disabled={!submissionId}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="button primary" onClick={submit} disabled={busy}>
            <Play size={16} /> Submit
          </button>
        </div>
        <Editor
          theme="vs-dark"
          language={language === 'cpp' ? 'cpp' : language}
          value={sourceCode}
          onChange={(value) => setSourceCode(value ?? '')}
          options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: 'on' }}
        />
        <div className="panel" style={{ padding: 12 }}>
          <strong>Latest status:</strong> {status}
        </div>
      </section>
    </main>
  );
}
