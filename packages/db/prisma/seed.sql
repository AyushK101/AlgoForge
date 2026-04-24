INSERT INTO "Language" ("slug", "name", "sourceFile", "compileCommand", "runCommand")
VALUES
  ('cpp', 'C++20', 'main.cpp', ARRAY['g++', 'main.cpp', '-O2', '-std=c++20', '-pipe', '-o', 'main'], ARRAY['./main']),
  ('c', 'C17', 'main.c', ARRAY['gcc', 'main.c', '-O2', '-std=c17', '-pipe', '-o', 'main'], ARRAY['./main']),
  ('java', 'Java', 'Main.java', ARRAY['javac', 'Main.java'], ARRAY['java', '-Xmx256m', 'Main']),
  ('python', 'Python 3', 'main.py', ARRAY[]::TEXT[], ARRAY['python3', 'main.py'])
ON CONFLICT ("slug") DO NOTHING;

WITH problem AS (
  INSERT INTO "Problem" ("slug", "title", "difficulty", "statement", "constraints", "tags", "isPublished")
  VALUES (
    'a-plus-b',
    'A Plus B',
    'EASY',
    'Read two integers from standard input and print their sum.',
    'Each integer fits in a signed 32-bit value.',
    ARRAY['implementation', 'math'],
    TRUE
  )
  ON CONFLICT ("slug") DO UPDATE SET "slug" = EXCLUDED."slug"
  RETURNING "id"
)
INSERT INTO "Testcase" ("problemId", "name", "input", "expectedOutput", "isSample")
SELECT "id", 'sample-1', '2 3
', '5
', TRUE FROM problem
ON CONFLICT ("problemId", "name") DO NOTHING;

WITH problem AS (
  SELECT "id" FROM "Problem" WHERE "slug" = 'a-plus-b'
)
INSERT INTO "Testcase" ("problemId", "name", "input", "expectedOutput", "isSample")
SELECT "id", 'hidden-1', '-7 10
', '3
', FALSE FROM problem
ON CONFLICT ("problemId", "name") DO NOTHING;

WITH problem AS (
  SELECT "id" FROM "Problem" WHERE "slug" = 'a-plus-b'
)
INSERT INTO "ProblemVersion" ("problemId", "version", "snapshot")
SELECT "id", 1, '{"title":"A Plus B","statement":"Read two integers from standard input and print their sum."}'::JSONB
FROM problem
ON CONFLICT ("problemId", "version") DO NOTHING;
