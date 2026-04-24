'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export function ProblemBuilder() {
  const [status, setStatus] = useState('');

  async function submit(formData: FormData) {
    setStatus('Saving...');
    const samples = String(formData.get('samples') ?? '')
      .split('\n---\n')
      .filter(Boolean)
      .map((block, index) => {
        const [input = '', expectedOutput = ''] = block.split('\n=>\n');
        return { name: `sample-${index + 1}`, input, expectedOutput, isSample: true, weight: 1 };
      });

    try {
      const result = await api.createProblem({
        title: String(formData.get('title')),
        slug: String(formData.get('slug')),
        difficulty: formData.get('difficulty') as 'EASY' | 'MEDIUM' | 'HARD',
        statement: String(formData.get('statement')),
        constraints: String(formData.get('constraints')),
        tags: String(formData.get('tags') ?? '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        testcases: samples,
      });
      setStatus(`Created ${result.problem.slug}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to create problem');
    }
  }

  return (
    <main className="page">
      <form className="stack" action={submit}>
        <h1>New Problem</h1>
        <input className="input" name="title" placeholder="Title" required />
        <input className="input" name="slug" placeholder="two-sum" required />
        <select className="input" name="difficulty" defaultValue="EASY">
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
        <input className="input" name="tags" placeholder="array,hash-map" />
        <textarea className="input" name="statement" placeholder="Statement" rows={8} required />
        <textarea className="input" name="constraints" placeholder="Constraints" rows={4} />
        <textarea
          className="input"
          name="samples"
          placeholder={'input\n=>\nexpected output\n---\nnext input\n=>\nnext output'}
          rows={8}
          required
        />
        <button className="button primary" type="submit">
          Create problem
        </button>
        <p className="muted">{status}</p>
      </form>
    </main>
  );
}
