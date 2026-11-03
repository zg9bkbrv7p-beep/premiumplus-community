import { defaultPlan, validatePlan } from "../../shared/geometry";
import type { Project } from "../api";
export interface StudioStorage {
  request: <T = any>(path: string, method?: string, body?: any) => Promise<T>;
}
type Stored = { project: Project; versions: any[] };
export function sampleProject(): Project {
  const p = defaultPlan();
  p.walls.push({
    id: "sample-partition",
    a: { x: 4.7, y: 0 },
    b: { x: 4.7, y: 6 },
    height: 2.8,
    thickness: 0.15,
    color: "#e8e2d8",
  });
  p.openings = [
    {
      id: "sample-door",
      wallId: "sample-partition",
      kind: "door",
      offset: 2,
      width: 1,
      height: 2.1,
      sill: 0,
    },
    {
      id: "sample-window",
      wallId: "w2",
      kind: "window",
      offset: 1.5,
      width: 2,
      height: 1.4,
      sill: 0.8,
    },
  ];
  p.furniture = [
    {
      id: "sample-sofa",
      kind: "sofa",
      x: 2,
      y: 1.2,
      width: 2.2,
      depth: 0.9,
      height: 0.8,
      rotation: 0,
      color: "#bdb5a3",
    },
    {
      id: "sample-table",
      kind: "table",
      x: 2,
      y: 3,
      width: 1.4,
      depth: 0.8,
      height: 0.45,
      rotation: 0,
      color: "#9c7955",
    },
    {
      id: "sample-cabinet",
      kind: "cabinet",
      x: 6.2,
      y: 0.4,
      width: 2.2,
      depth: 0.6,
      height: 0.9,
      rotation: 0,
      color: "#ccbba3",
    },
    {
      id: "sample-fridge",
      kind: "refrigerator",
      x: 7.4,
      y: 1.1,
      width: 0.8,
      depth: 0.8,
      height: 1.9,
      rotation: 90,
      color: "#b8c0bc",
    },
    {
      id: "sample-plant",
      kind: "plant",
      x: 3.9,
      y: 4.6,
      width: 0.6,
      depth: 0.6,
      height: 1.4,
      rotation: 0,
      color: "#507950",
    },
  ];
  return {
    id: "demo-local",
    name: "Interactive 3D sample",
    address: "Sample living space · not a customer project",
    description:
      "Explore real geometry, materials and furnishings. Saved only in this browser.",
    revision: 1,
    plan: validatePlan(p),
    image: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
export function createDemoStore(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  key: string,
): StudioStorage & { read: () => Project; reset: () => Project } {
  function load(): Stored {
    const raw = storage.getItem(key);
    if (raw) {
      try {
        const s = JSON.parse(raw);
        if (
          s.project.id !== "demo-local" ||
          !Number.isInteger(s.project.revision) ||
          s.project.revision < 1 ||
          !Array.isArray(s.versions)
        )
          throw Error();
        s.project.plan = validatePlan(s.project.plan);
        return s;
      } catch {
        throw Error(
          "Saved demo data is invalid. Reset the sample to continue.",
        );
      }
    }
    return { project: sampleProject(), versions: [] };
  }
  function persist(s: Stored) {
    try {
      storage.setItem(key, JSON.stringify(s));
    } catch {
      throw Error(
        "Browser storage is full or unavailable. Your edits remain open; reset the demo or free storage.",
      );
    }
  }
  return {
    read: () => structuredClone(load().project),
    reset: () => {
      storage.removeItem(key);
      return sampleProject();
    },
    request: async <T = any>(path: string, method = "GET", body: any = {}) => {
      const s = load(),
        base = "/projects/demo-local";
      if (path === base && method === "PATCH") {
        if (body.revision !== s.project.revision)
          throw Error(
            "Sample changed in another tab. Reopen it before saving.",
          );
        const plan = validatePlan(body.plan);
        s.project = {
          ...s.project,
          plan,
          revision: s.project.revision + 1,
          updatedAt: new Date().toISOString(),
          ...(body.image ? { image: body.image } : {}),
        };
        persist(s);
        return structuredClone(s.project) as T;
      }
      if (path === base + "/design-versions" && method === "GET")
        return structuredClone(
          s.versions.map(({ plan, image, ...summary }) => summary),
        ) as T;
      if (path === base + "/design-versions" && method === "POST") {
        const v = {
          id: crypto.randomUUID(),
          label: String(body.label).slice(0, 100),
          project_revision: s.project.revision,
          plan: structuredClone(s.project.plan),
          image: s.project.image,
          created_at: new Date().toISOString(),
          sha256: "Browser-local sample",
        };
        s.versions.unshift(v);
        persist(s);
        return structuredClone(v) as T;
      }
      if (method === "GET" && path.startsWith(base + "/design-versions/")) {
        const v = s.versions.find((v) => v.id === path.split("/").pop());
        if (v) return structuredClone(v) as T;
      }
      throw Error(
        "This action is unavailable in the isolated demo. Create a real project for customer work.",
      );
    },
  };
}
