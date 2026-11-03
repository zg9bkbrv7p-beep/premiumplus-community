import { test, expect } from "vitest";
import { createDemoStore, sampleProject } from "../../src/demo/store";
test("sample editor storage never reaches customer projects and remains independent per user", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) || null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => values.delete(k),
  };
  const a = createDemoStore(storage, "demo:a"),
    b = createDemoStore(storage, "demo:b");
  const p = a.read();
  expect(p.plan.furniture.length).toBeGreaterThan(0);
  p.plan.floorColor = "#123456";
  const saved = await a.request("/projects/demo-local", "PATCH", {
    revision: 1,
    plan: p.plan,
  });
  expect(saved.revision).toBe(2);
  expect(a.read().plan.floorColor).toBe("#123456");
  expect(b.read().plan.floorColor).toBe(sampleProject().plan.floorColor);
  await expect(
    a.request("/projects/REAL-PROJECT", "PATCH", {}),
  ).rejects.toThrow("isolated demo");
  await a.request("/projects/demo-local/design-versions", "POST", {
    label: "Local version",
  });
  expect(await a.request("/projects/demo-local/design-versions")).toHaveLength(
    1,
  );
  a.reset();
  expect(a.read().revision).toBe(1);
  expect(b.read().revision).toBe(1);
});
