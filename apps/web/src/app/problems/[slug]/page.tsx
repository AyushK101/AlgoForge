import { api } from '@/lib/api';
import { ProblemWorkspace } from '@/components/problem-workspace';

export default async function ProblemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { problem } = await api.getProblem(slug);
  return <ProblemWorkspace problem={problem} />;
}
