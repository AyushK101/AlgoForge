import type { FastifyInstance } from "fastify";
import { prisma } from "@algoforge/db";
import { createProblemSchema } from "@algoforge/types";

function isDatabaseUnavailableError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Can't reach database server") ||
    error.message.includes("Environment variable not found: DATABASE_URL") ||
    error.message.includes("The table `public.Problem` does not exist") ||
    error.message.includes("The table `public.problem` does not exist")
  );
}

export async function problemRoutes(app: FastifyInstance) {
  app.get("/problems", async (request) => {
    const query = request.query as {
      search?: string;
      difficulty?: "EASY" | "MEDIUM" | "HARD";
      tag?: string;
      page?: string;
      limit?: string;
    };
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(query.limit ?? 20)));
    type ProblemListItem = {
      id: string;
      slug: string;
      title: string;
      difficulty: "EASY" | "MEDIUM" | "HARD";
      tags: string[];
      createdAt: Date;
    };

    let problems: ProblemListItem[] = [];
    try {
      problems = await prisma.problem.findMany({
        where: {
          difficulty: query.difficulty,
          tags: query.tag ? { has: query.tag } : undefined,
          OR: query.search
            ? [
                { title: { contains: query.search, mode: "insensitive" } },
                { slug: { contains: query.search, mode: "insensitive" } },
              ]
            : undefined,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          difficulty: true,
          tags: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) {
        throw error;
      }
      request.log.warn(
        { error },
        "Database unavailable; returning empty problem list",
      );
    }

    return { problems, page, limit };
  });

  app.get("/problems/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const problem = await prisma.problem.findUnique({
      where: { slug },
      include: {
        testcases: {
          where: { isSample: true },
          select: {
            id: true,
            name: true,
            input: true,
            expectedOutput: true,
            isSample: true,
          },
        },
      },
    });

    if (!problem) {
      return reply.code(404).send({ error: "Problem not found" });
    }

    return { problem };
  });

  app.post("/admin/problems", async (request, reply) => {
    const input = createProblemSchema.parse(request.body);
    const problem = await prisma.problem.create({
      data: {
        title: input.title,
        slug: input.slug,
        difficulty: input.difficulty,
        statement: input.statement,
        constraints: input.constraints,
        tags: input.tags,
        isPublished: true,
        testcases: {
          create: input.testcases,
        },
        versions: {
          create: {
            version: 1,
            snapshot: input,
          },
        },
      },
      include: { testcases: true },
    });

    return reply.code(201).send({ problem });
  });
}
