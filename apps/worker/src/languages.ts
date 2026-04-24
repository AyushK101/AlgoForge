import type { ExecutionJobPayload } from '@algoforge/judge-protocol';

export type RuntimeCommand = {
  sourceFile: string;
  compile?: string[];
  run: string[];
};

export function runtimeFor(language: ExecutionJobPayload['languageSlug']): RuntimeCommand {
  switch (language) {
    case 'c':
      return {
        sourceFile: 'main.c',
        compile: ['gcc', 'main.c', '-O2', '-std=c17', '-pipe', '-o', 'main'],
        run: ['./main'],
      };
    case 'cpp':
      return {
        sourceFile: 'main.cpp',
        compile: ['g++', 'main.cpp', '-O2', '-std=c++20', '-pipe', '-o', 'main'],
        run: ['./main'],
      };
    case 'java':
      return {
        sourceFile: 'Main.java',
        compile: ['javac', 'Main.java'],
        run: ['java', '-Xmx256m', 'Main'],
      };
    case 'python':
      return {
        sourceFile: 'main.py',
        run: ['python3', 'main.py'],
      };
  }
}
