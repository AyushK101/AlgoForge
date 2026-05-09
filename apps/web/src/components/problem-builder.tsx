"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Save } from "lucide-react";

export function ProblemBuilder() {
  const [status, setStatus] = useState("");

  async function submit(formData: FormData) {
    setStatus("Saving...");
    const samples = String(formData.get("samples") ?? "")
      .split("\n---\n")
      .filter(Boolean)
      .map((block, index) => {
        const [input = "", expectedOutput = ""] = block.split("\n=>\n");
        return {
          name: `sample-${index + 1}`,
          input,
          expectedOutput,
          isSample: true,
          weight: 1,
        };
      });

    try {
      const result = await api.createProblem({
        title: String(formData.get("title")),
        slug: String(formData.get("slug")),
        difficulty: formData.get("difficulty") as "EASY" | "MEDIUM" | "HARD",
        statement: String(formData.get("statement")),
        constraints: String(formData.get("constraints")),
        tags: String(formData.get("tags") ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        testcases: samples,
      });
      setStatus(`Successfully created ${result.problem.slug}`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Failed to create problem",
      );
    }
  }

  return (
    <main className="page" style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 40 }}>
        <h1
          style={{ fontSize: "2.5rem", fontWeight: 800, margin: "0 0 8px 0" }}
        >
          New Problem
        </h1>
        <p className="muted">Define a new challenge for the community.</p>
      </div>

      <form className="stack" action={submit} style={{ gap: 24 }}>
        <div className="panel" style={{ padding: 32 }}>
          <div className="stack" style={{ gap: 20 }}>
            <div className="stack" style={{ gap: 8 }}>
              <label
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--accents-6)",
                }}
              >
                Title
              </label>
              <input
                className="input"
                name="title"
                placeholder="e.g. Two Sum"
                required
              />
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <label
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--accents-6)",
                }}
              >
                Slug
              </label>
              <input
                className="input"
                name="slug"
                placeholder="e.g. two-sum"
                required
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              <div className="stack" style={{ gap: 8 }}>
                <label
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--accents-6)",
                  }}
                >
                  Difficulty
                </label>
                <select className="input" name="difficulty" defaultValue="EASY">
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                <label
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--accents-6)",
                  }}
                >
                  Tags (comma separated)
                </label>
                <input
                  className="input"
                  name="tags"
                  placeholder="e.g. array,hash-map"
                />
              </div>
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <label
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--accents-6)",
                }}
              >
                Statement
              </label>
              <textarea
                className="input"
                name="statement"
                placeholder="Describe the problem..."
                style={{ height: 200, padding: 12 }}
                required
              />
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <label
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--accents-6)",
                }}
              >
                Constraints
              </label>
              <textarea
                className="input"
                name="constraints"
                placeholder="e.g. 1 <= n <= 10^5"
                style={{ height: 100, padding: 12 }}
              />
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <label
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--accents-6)",
                }}
              >
                Sample Testcases
              </label>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--accents-4)",
                  marginBottom: 4,
                }}
              >
                {"Format: input\\n=>\\nexpected output\\n---\\nnext..."}
              </div>
              <textarea
                className="input"
                name="samples"
                placeholder={
                  "input\n=>\nexpected output\n---\nnext input\n=>\nnext output"
                }
                style={{
                  height: 150,
                  padding: 12,
                  fontFamily: "var(--font-mono)",
                }}
                required
              />
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <p
            style={{
              fontSize: "0.875rem",
              margin: 0,
              color: status.includes("Successfully")
                ? "var(--geist-success)"
                : status.includes("Failed")
                  ? "var(--geist-error)"
                  : "var(--accents-5)",
            }}
          >
            {status}
          </p>
          <button
            className="button primary"
            type="submit"
            style={{ width: 160 }}
          >
            <Save size={16} /> Create Problem
          </button>
        </div>
      </form>
    </main>
  );
}
