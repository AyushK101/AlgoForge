import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

await prisma.language.upsert({
  where: { slug: 'cpp' },
  create: {
    slug: 'cpp',
    name: 'C++20',
    sourceFile: 'main.cpp',
    compileCommand: ['g++', 'main.cpp', '-O2', '-std=c++20', '-pipe', '-o', 'main'],
    runCommand: ['./main'],
  },
  update: {},
});

await prisma.language.upsert({
  where: { slug: 'c' },
  create: {
    slug: 'c',
    name: 'C17',
    sourceFile: 'main.c',
    compileCommand: ['gcc', 'main.c', '-O2', '-std=c17', '-pipe', '-o', 'main'],
    runCommand: ['./main'],
  },
  update: {},
});

await prisma.language.upsert({
  where: { slug: 'java' },
  create: {
    slug: 'java',
    name: 'Java',
    sourceFile: 'Main.java',
    compileCommand: ['javac', 'Main.java'],
    runCommand: ['java', '-Xmx256m', 'Main'],
  },
  update: {},
});

await prisma.language.upsert({
  where: { slug: 'python' },
  create: {
    slug: 'python',
    name: 'Python 3',
    sourceFile: 'main.py',
    compileCommand: [],
    runCommand: ['python3', 'main.py'],
  },
  update: {},
});

await prisma.problem.upsert({
  where: { slug: 'a-plus-b' },
  create: {
    slug: 'a-plus-b',
    title: 'A Plus B',
    difficulty: 'EASY',
    statement: 'Read two integers from standard input and print their sum.',
    constraints: 'Each integer fits in a signed 32-bit value.',
    tags: ['implementation', 'math'],
    isPublished: true,
    testcases: {
      create: [
        { name: 'sample-1', input: '2 3\n', expectedOutput: '5\n', isSample: true },
        { name: 'hidden-1', input: '-7 10\n', expectedOutput: '3\n', isSample: false },
      ],
    },
    versions: {
      create: {
        version: 1,
        snapshot: {
          title: 'A Plus B',
          statement: 'Read two integers from standard input and print their sum.',
        },
      },
    },
  },
  update: {},
});

await prisma.$disconnect();
