import { useMemo, useState } from "react";
import Studio from "../design/Studio";
import { createDemoStore, sampleProject } from "./store";
import type { Project } from "../api";
export default function DemoStudio({
  userId,
  onBack,
  onDirty,
}: {
  userId: string;
  onBack: () => void;
  onDirty: (v: boolean) => void;
}) {
  const store = useMemo(
    () =>
      createDemoStore(
        {
          getItem: (k) => localStorage.getItem(k),
          setItem: (k, v) => localStorage.setItem(k, v),
          removeItem: (k) => localStorage.removeItem(k),
        },
        `premium-vision:demo:v1:${userId}`,
      ),
    [userId],
  );
  const [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [project, setProject] = useState<Project>(() => {
      try {
        return store.read();
      } catch (e: any) {
        return sampleProject();
      }
    });
  return (
    <>
      <div className="project-heading">
        <button className="back-link" onClick={onBack}>
          ← Back to workspace
        </button>
        <div className="project-title-line">
          <div>
            <span className="eyebrow">
              INTERACTIVE SAMPLE · SEPARATE FROM CUSTOMER WORK
            </span>
            <h1>Explore your 3D studio.</h1>
            <p>
              Edit walls, move furnishings, try materials, orbit in 3D and save
              locally. Demo edits stay in this browser and do not create a
              customer project.
            </p>
          </div>
          <button
            className="btn secondary"
            onClick={() => {
              if (
                confirm(
                  "Reset only this sample? Customer projects will not be changed.",
                )
              ) {
                try {
                  setProject(store.reset());
                  setVersion((v) => v + 1);
                  onDirty(false);
                  setError("");
                } catch (e: any) {
                  setError(e.message);
                }
              }
            }}
          >
            Reset sample
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
      <Studio
        initialView="3d"
        key={version}
        project={project}
        onSaved={setProject}
        onDirty={onDirty}
        storage={store}
      />
    </>
  );
}
