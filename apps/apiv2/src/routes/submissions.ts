import type { FastifyInstance } from "fastify";
import { prisma } from "@algoforge/db";
import {
  aggregateSubmission,
  createSubmission,
} from "../services/submission-service.js";

export async function submissionRoutes(app: FastifyInstance) {
  app.post("/submissions", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"]?.toString();
      const submission = await createSubmission(request.body, userId);
      return reply
        .code(202)
        .send({ submissionId: submission.id, status: "QUEUED" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid submission";
      return reply.code(400).send({ error: message });
    }
  });

  app.get("/submissions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await aggregateSubmission(id);
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        problem: { select: { slug: true, title: true } },
        language: { select: { slug: true, name: true } },
        jobs: {
          include: {
            testcase: { select: { name: true, isSample: true } },
            result: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!submission)
      return reply.code(404).send({ error: "Submission not found" });
    return { submission };
  });

  app.get("/problems/:slug/submissions", async (request) => {
    const { slug } = request.params as { slug: string };
    const userId = request.headers["x-user-id"]?.toString();
    const submissions = await prisma.submission.findMany({
      where: {
        userId,
        problem: { slug },
      },
      include: {
        language: { select: { slug: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return { submissions };
  });
}
