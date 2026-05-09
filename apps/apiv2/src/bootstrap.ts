import { prisma } from "@algoforge/db";

export const supportedLanguages = [
  {
    slug: "cpp" as const,
    name: "C++20",
    sourceFile: "main.cpp",
    compileCommand: [
      "g++",
      "main.cpp",
      "-O2",
      "-std=c++20",
      "-pipe",
      "-o",
      "main",
    ],
    runCommand: ["./main"],
    defaultCpuMs: 2000,
    defaultMemoryKb: 262144,
  },
  {
    slug: "c" as const,
    name: "C17",
    sourceFile: "main.c",
    compileCommand: ["gcc", "main.c", "-O2", "-std=c17", "-pipe", "-o", "main"],
    runCommand: ["./main"],
    defaultCpuMs: 2000,
    defaultMemoryKb: 262144,
  },
  {
    slug: "java" as const,
    name: "Java",
    sourceFile: "Main.java",
    compileCommand: ["javac", "Main.java"],
    runCommand: ["java", "-Xmx256m", "Main"],
    defaultCpuMs: 2000,
    defaultMemoryKb: 262144,
  },
  {
    slug: "python" as const,
    name: "Python 3",
    sourceFile: "main.py",
    compileCommand: [],
    runCommand: ["python3", "main.py"],
    defaultCpuMs: 2000,
    defaultMemoryKb: 262144,
  },
];

export async function seedLanguages() {
  for (const language of supportedLanguages) {
    await prisma.language.upsert({
      where: { slug: language.slug },
      create: language,
      update: {
        name: language.name,
        sourceFile: language.sourceFile,
        compileCommand: language.compileCommand,
        runCommand: language.runCommand,
        defaultCpuMs: language.defaultCpuMs,
        defaultMemoryKb: language.defaultMemoryKb,
        isEnabled: true,
      },
    });
  }
}

export async function ensureLanguageSeeded(
  slug: (typeof supportedLanguages)[number]["slug"],
) {
  const language = supportedLanguages.find((item) => item.slug === slug);
  if (!language) return null;

  await prisma.language.upsert({
    where: { slug: language.slug },
    create: language,
    update: {
      name: language.name,
      sourceFile: language.sourceFile,
      compileCommand: language.compileCommand,
      runCommand: language.runCommand,
      defaultCpuMs: language.defaultCpuMs,
      defaultMemoryKb: language.defaultMemoryKb,
      isEnabled: true,
    },
  });

  return language;
}
