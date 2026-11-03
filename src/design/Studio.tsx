import type {StudioStorage} from '../demo/store';
import { useEffect, useRef, useState } from "react";
import {
  MousePointer2,
  PenTool,
  DoorOpen,
  Square,
  Armchair,
  Undo2,
  Redo2,
  Trash2,
  Save,
  Camera,
  Box,
  Grid2X2,
  ZoomIn,
  ZoomOut,
  Move,
  RotateCw,
  Plus,
  Check,
  PanelRightClose,
  Download,
} from "lucide-react";
import { api, type Project } from "../api";
import {
  History,
  validatePlan,
  snap,
  length,
  removeWall,
  type Plan,
  type Furniture,
} from "../../shared/geometry";
import SceneView, { type SceneHandle } from "./SceneView";
import { measurePlan } from "../../shared/measurements";
import { appendDimensionedWall } from "../../shared/fusionWall";
import { moveEndpoint, moveWall, snapWallPoint } from "../../shared/editing";
import { formatImperial, parseImperial, snapToGrid, type Grid } from "../../shared/units";
import "./commercial-editor.css";
type Version = { id: string; label: string; created_at: string; project_revision: number };
type Snapshot = Version & { plan: Plan; image: string | null };
type Tool = "select" | "wall" | "door" | "window";
export default function Studio({
  project,
  onSaved,
  onDirty,
  storage,
  initialView = "2d",
  initialMeasuredWallFeet,
}: {
  project: Project;
  onSaved: (p: Project) => void;
  onDirty: (dirty: boolean) => void;
  storage?:StudioStorage;
  initialView?:"2d"|"3d";
  initialMeasuredWallFeet?:number;
}) {
  const studioRequest=storage?.request||api;
  const history = useRef(new History<Plan>(structuredClone(project.plan))),
    [plan, setPlan] = useState(history.current.present),
    [tool, setTool] = useState<Tool>("select"),
    [selected, setSelected] = useState(""),
    [view, setView] = useState<string>(initialView),
    [dirty, setDirty] = useState(false),
    [revision, setRevision] = useState(project.revision),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("All changes saved"),
    [error, setError] = useState(""),
    [start, setStart] = useState<{ x: number; y: number } | null>(null),
    [cursor, setCursor] = useState<{ x: number; y: number } | null>(null),
    [zoom, setZoom] = useState(1),
    [center, setCenter] = useState({x:4,y:3}),
    [inspector, setInspector] = useState(true),
    [units, setUnits] = useState("metric"),
    [grid, setGrid] = useState<Grid>("metric"),
    [category, setCategory] = useState("Living"),
    [versions, setVersions] = useState<Version[]>([]),
    [versionLabel, setVersionLabel] = useState(""),
    [before, setBefore] = useState<Snapshot | null>(null),
    [comparison, setComparison] = useState(false);
  const [draftLength, setDraftLength] = useState(String(initialMeasuredWallFeet ?? 12));
  const [draftHeight, setDraftHeight] = useState('8');
  const [draftThickness, setDraftThickness] = useState('5.5');
  const svg = useRef<SVGSVGElement>(null),
    scene = useRef<SceneHandle>(null),
    drag = useRef<any>(null);
  useEffect(() => {
    onDirty(dirty);
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, onDirty]);
  const edits = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function loadVersions() {
    try { const rows = await studioRequest<Version[]>(`/projects/${project.id}/design-versions`); if(mounted.current) setVersions(rows); }
    catch(e: any) { if(mounted.current) setError(e.message); }
  }
  useEffect(() => { void loadVersions(); }, [project.id]);
  async function createVersion() {
    setBusy(true); setError("");
    try {
      await studioRequest(`/projects/${project.id}/design-versions`, "POST", {label: versionLabel.trim() || `Design ${versions.length + 1}`});
      if(mounted.current) { setVersionLabel(""); await loadVersions(); setMessage("Saved design version created"); }
    } catch(e:any) { if(mounted.current) setError(e.message); }
    finally { if(mounted.current) setBusy(false); }
  }
  const versionRequest = useRef(0);
  async function chooseVersion(id: string) {
    const request = ++versionRequest.current;
    if (!id) {setBefore(null); setComparison(false); return;}
    try { const snapshot = await studioRequest<Snapshot>(`/projects/${project.id}/design-versions/${id}`);
      if(mounted.current && request === versionRequest.current) setBefore({...snapshot, plan: validatePlan(snapshot.plan)});
    } catch(e:any) { if(mounted.current && request === versionRequest.current) setError(e.message); }
  }
  useEffect(() => {
    if (!dirty) setRevision(project.revision);
  }, [project.revision, dirty]);
  const wall = plan.walls.find((w) => w.id === selected),
    furn = plan.furniture.find((f) => f.id === selected),
    opening = plan.openings.find((o) => o.id === selected);
  function commit(next: Plan) {
    try {
      const valid = validatePlan(next);
      edits.current++;
      history.current.commit(valid);
      setPlan(valid);
      setDirty(true);
      setMessage("Unsaved changes");
      setError("");
      return true;
    } catch (e: any) {
      setError(
        e.message?.startsWith("[")
          ? "Check the selected dimensions and try again."
          : e.message,
      );
      return false;
    }
  }
  function addPreciseWall() {
    try {
      const next = appendDimensionedWall(plan, {
        lengthFeet: Number(draftLength),
        heightFeet: Number(draftHeight),
        thicknessInches: Number(draftThickness),
        color: '#e8e2d8',
      }, crypto.randomUUID());
      if (commit(next)) {
        setSelected(next.walls[next.walls.length - 1].id);
        setTool('select');
        setView('2d');
        setStart(null);
        const xs = next.walls.flatMap(w=>[w.a.x,w.b.x]);
        const ys = next.walls.flatMap(w=>[w.a.y,w.b.y]);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        setCenter({x:(minX+maxX)/2,y:(minY+maxY)/2});
        setZoom(Math.min(1,14/(maxX-minX+2),10/(maxY-minY+2)));
        setMessage('Measured wall added to draft. Review dimensions and save.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Wall could not be added.');
    }
  }
  function change(fn: (p: Plan) => void) {
    const n = structuredClone(plan);
    fn(n);
    commit(n);
  }
  function point(e: React.PointerEvent) {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      svg.current!.getScreenCTM()!.inverse(),
    );
    const pt = { x: snapToGrid(p.x, grid), y: snapToGrid(p.y, grid) };
    return tool === "wall" ? snapWallPoint(pt, plan.walls, start) : pt;
  }
  function down(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const pt = point(e);
    if (tool === "wall") {
      if (!start) {
        setStart(pt);
        setCursor(pt);
      } else if (Math.hypot(start.x - pt.x, start.y - pt.y) >= 0.2) {
        const id = crypto.randomUUID();
        if (
          commit({
            ...plan,
            walls: [
              ...plan.walls,
              {
                id,
                a: start,
                b: pt,
                height: 2.8,
                thickness: 0.15,
                color: "#e8e2d8",
              },
            ],
          })
        ) {
          setSelected(id);
          setStart(null);
        }
      }
      return;
    }
    if (tool === "select") {
      setSelected("");
      setError("");
    }
  }
  function selectWall(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    const w = plan.walls.find((w) => w.id === id)!;
    if (tool === "wall") {
      down(e);
      return;
    }
    if (tool === "door" || tool === "window") {
      const pt = point(e),
        len = length(w);
      const along =
        ((pt.x - w.a.x) * (w.b.x - w.a.x) + (pt.y - w.a.y) * (w.b.y - w.a.y)) /
        len;
      const width = tool === "door" ? 0.9 : 1.2;
      const offset = Math.max(
        0,
        Math.min(len - width, snap(along - width / 2)),
      );
      const oid = crypto.randomUUID();
      if (
        commit({
          ...plan,
          openings: [
            ...plan.openings,
            {
              id: oid,
              wallId: id,
              kind: tool,
              offset,
              width,
              height: tool === "door" ? 2.1 : 1.1,
              sill: tool === "door" ? 0 : 1,
            },
          ],
        })
      ) {
        setSelected(oid);
        setTool("select");
      }
      return;
    }
    setSelected(id);
    drag.current = { kind: "wall", id, point: point(e), base: plan };
    svg.current?.setPointerCapture(e.pointerId);
  }
  function pointerMove(e: React.PointerEvent) {
    const pt = point(e);
    if (start) setCursor(pt);
    if (!drag.current) return;
    const d = drag.current,
      dx = pt.x - d.point.x,
      dy = pt.y - d.point.y,
      n = structuredClone(d.base) as Plan;
    if (d.kind === "furniture") {
      const f = n.furniture.find((f) => f.id === d.id)!;
      f.x = snapToGrid(f.x + dx, grid);
      f.y = snapToGrid(f.y + dy, grid);
    } else {
      const next = d.kind === "endpoint"
        ? moveEndpoint(d.base, d.id, d.end, snapWallPoint(pt, d.base.walls.filter((w: any) => w.id !== d.id)))
        : moveWall(d.base, d.id, dx, dy);
      setPlan(next);
      return;
    }
    setPlan(n);
  }
  function pointerUp() {
    if (drag.current) {
      const latest = plan;
      drag.current = null;
      if (!commit(latest)) setPlan(history.current.present);
    }
  }
  function add(kind: Furniture["kind"]) {
    const dims = {
        sofa: [2.4, 0.95, 1],
        table: [1.5, 0.8, 0.75],
        bed: [1.8, 2.1, 0.7],
        plant: [0.5, 0.5, 1],
        cabinet: [0.9, 0.6, 0.9],
        refrigerator: [0.9, 0.75, 1.8],
        oven: [0.6, 0.6, 0.9],
        chair: [0.6, 0.6, 0.9],
      }[kind],
      id = crypto.randomUUID();
    if (
      commit({
        ...plan,
        furniture: [
          ...plan.furniture,
          {
            id,
            kind,
            x: 4,
            y: 3,
            rotation: 0,
            width: dims[0],
            depth: dims[1],
            height: dims[2],
            color: kind === "plant" ? "#608467" : "#bca888",
          },
        ],
      })
    ) {
      setSelected(id);
      setTool("select");
    }
  }
  function remove() {
    if (wall) commit(removeWall(plan, selected));
    else
      change((p) => {
        p.furniture = p.furniture.filter((f) => f.id !== selected);
        p.openings = p.openings.filter((o) => o.id !== selected);
      });
    setSelected("");
  }
  async function save(image?: string) {
    const submittedEdit = edits.current;
    setBusy(true);
    setError("");
    try {
      const p = await studioRequest<Project>("/projects/" + project.id, "PATCH", {
        revision,
        plan,
        ...(image ? { image } : {}),
      });
      setRevision(p.revision);
      onSaved(p);
      const newerEdits = edits.current !== submittedEdit;
      setDirty(newerEdits);
      setMessage(
        newerEdits
          ? "Unsaved changes"
          : image
            ? "Image saved to project"
            : "All changes saved",
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function undo() {
    edits.current++;
    setPlan(history.current.undo());
    setDirty(true);
    setMessage("Unsaved changes");
  }
  function redo() {
    edits.current++;
    setPlan(history.current.redo());
    setDirty(true);
    setMessage("Unsaved changes");
  }
  const numberField = (
    label: string,
    value: number,
    cb: (n: number) => void,
    min = 0,
    max = 100,
  ) => (
    <label className="compact-field">
      <span>{label}</span>
      {units === "imperial" && label !== "Rotation" ? <input
        key={`${label}-${value}`}
        aria-label={label}
        defaultValue={formatImperial(value)}
        onBlur={(e) => {
          const meters = parseImperial(e.target.value);
          if (meters !== null && meters >= min && meters <= max) { if (Math.abs(meters-value)>0.00013) cb(meters); }
          else { setError('Enter feet and inches, for example 5 ft 6 in.'); e.target.value = formatImperial(value); }
        }}
        onKeyDown={(e) => { if(e.key === "Enter") e.currentTarget.blur(); }}
      /> : <input
        aria-label={label}
        type="number"
        step=".1"
        min={min}
        max={max}
        value={Number(value.toFixed(4))}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) cb(n);
        }}
      />}
    </label>
  );
  return (
    <div className="studio">
      <div className="studio-top">
        <div>
          <span className="studio-live-dot" />
          <strong>Your design studio</strong>
          <span className="studio-subtitle">ONE PLAN. EVERY PERSPECTIVE.</span>
        </div>
        <div className="studio-actions">
          <span className={"save-state " + (dirty ? "dirty" : "")}>
            <span />
            {message}
          </span>
          <button
            className="btn studio-save"
            disabled={busy}
            onClick={() => save()}
          >
            <Save size={15} />
            {busy ? "Saving…" : "Save design"}
          </button>
        </div>
      </div>
      <div className="editor-options">
        <label>Units <select aria-label="Measurement units" value={units} onChange={e => setUnits(e.target.value)}><option value="metric">Meters</option><option value="imperial">Feet & inches</option></select></label>
        <label>Grid snap <select aria-label="Grid snap" value={grid} onChange={e => setGrid(e.target.value as Grid)}><option value="metric">0.2 m</option><option value="inch">1 inch</option><option value="six-inch">6 inches</option><option value="off">Off</option></select></label>
      </div>
      <section className="studio-wall-builder" aria-label="Wall dimensions builder">
        <div className="studio-wall-builder-heading"><strong>Wall Builder</strong><span>CAD-style precise geometry · no AI rendering</span></div>
        <div className="studio-wall-builder-fields">
          <label>Length (ft)<input aria-label="New wall length in feet" type="number" min="0.66" max="328" step="0.01" inputMode="decimal" value={draftLength} onChange={e=>setDraftLength(e.target.value)}/></label>
          <label>Height (ft)<input aria-label="New wall height in feet" type="number" min="0.5" max="32" step="0.01" inputMode="decimal" value={draftHeight} onChange={e=>setDraftHeight(e.target.value)}/></label>
          <label>Thickness (in)<input aria-label="New wall thickness in inches" type="number" min="1" max="39" step="0.1" inputMode="decimal" value={draftThickness} onChange={e=>setDraftThickness(e.target.value)}/></label>
          <button type="button" className="btn primary" onClick={addPreciseWall}>Add editable wall <Plus size={15}/></button>
        </div>
        <small>{initialMeasuredWallFeet ? 'Length transferred from your calibrated plan-image estimate. ' : ''}This creates an unsaved draft wall. Confirm real dimensions on site before quoting or construction.</small>
      </section>
      <div className="studio-toolbar">
        <div className="tool-group">
          {[
            ["select", MousePointer2, "Select & move"],
            ["wall", PenTool, "Draw wall"],
            ["door", DoorOpen, "Add door"],
            ["window", Square, "Add window"],
          ].map(([k, I, l]: any) => (
            <button
              key={k}
              aria-label={l}
              title={l}
              className={tool === k ? "active" : ""}
              onClick={() => {
                setTool(k);
                setStart(null);
              }}
            >
              <I size={18} />
              <span>{l}</span>
            </button>
          ))}
          <span className="toolbar-divider" />
          <button title="Undo" aria-label="Undo" onClick={undo}>
            <Undo2 size={18} />
          </button>
          <button title="Redo" aria-label="Redo" onClick={redo}>
            <Redo2 size={18} />
          </button>
        </div>
        <div className="view-segment">
          <button
            className={view === "2d" ? "active" : ""}
            onClick={() => setView("2d")}
          >
            <Grid2X2 size={15} />
            2D plan
          </button>
          <button
            className={view === "3d" ? "active" : ""}
            onClick={() => {
              setView("3d");
              setStart(null);
            }}
          >
            <Box size={15} />
            3D view
          </button>
        </div>
        <button
          className="icon-btn inspector-toggle"
          aria-label="Toggle inspector"
          onClick={() => setInspector(!inspector)}
        >
          <PanelRightClose size={18} />
        </button>
      </div>
      {error && (
        <div className="studio-error" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      <div className={"studio-body " + (!inspector ? "inspector-hidden" : "")}>
        <div className="canvas-area">
          {comparison && before ? (
            <div className="comparison-panes" aria-label="Read-only design comparison">
              <section><h4>Before · {before.label}</h4>{view === "3d" ? <SceneView plan={before.plan} /> : <PlanPreview plan={before.plan} />}</section>
              <section><h4>Current · {dirty ? "unsaved edits" : "saved design"}</h4>{view === "3d" ? <SceneView plan={plan} /> : <PlanPreview plan={plan} />}</section>
            </div>
          ) : view === "2d" ? (
            <>
              <svg
                ref={svg}
                data-testid="plan-canvas"
                className={"plan-canvas tool-" + tool}
                viewBox={`${center.x - 7 / zoom} ${center.y - 5 / zoom} ${14 / zoom} ${10 / zoom}`}
                onPointerDown={down}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                onPointerCancel={pointerUp}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setStart(null);
                    setTool("select");
                  }
                  if (e.key === "Delete" && selected) remove();
                  if ((e.ctrlKey || e.metaKey) && e.key === "z") {
                    e.preventDefault();
                    e.shiftKey ? redo() : undo();
                  }
                }}
                tabIndex={0}
                aria-label="Editable floor plan. Choose Draw wall and click two points. Select walls or furniture to edit."
              >
                <defs>
                  <pattern
                    id="studio-grid"
                    width=".2"
                    height=".2"
                    patternUnits="userSpaceOnUse"
                  >
                    <circle cx="0" cy="0" r=".009" fill="#a3aea2" />
                  </pattern>
                  <pattern
                    id="floor-hatch"
                    width=".22"
                    height="1"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 0 0 V 1"
                      stroke="#ad9579"
                      strokeWidth=".006"
                      opacity=".4"
                    />
                  </pattern>
                </defs>
                <rect
                  x="-100"
                  y="-100"
                  width="200"
                  height="200"
                  fill="#f2f3ed"
                />
                {measurePlan(plan).rooms.map(room => <polygon key={room.id} points={room.polygon.map(pt => `${pt.x},${pt.y}`).join(" ")} fill={plan.floorColor} opacity=".35" />)}
                <rect
                  x="-100"
                  y="-100"
                  width="200"
                  height="200"
                  fill="url(#studio-grid)"
                />
                {plan.walls.map((w) => (
                  <g key={w.id}>
                    <line
                      x1={w.a.x}
                      y1={w.a.y}
                      x2={w.b.x}
                      y2={w.b.y}
                      stroke={selected === w.id ? "#46725d" : "#596159"}
                      strokeWidth={w.thickness}
                      strokeLinecap="square"
                    />
                    <line
                      x1={w.a.x}
                      y1={w.a.y}
                      x2={w.b.x}
                      y2={w.b.y}
                      stroke="transparent"
                      strokeWidth=".34"
                      onPointerDown={(e) => selectWall(e, w.id)}
                    />
                    <text
                      x={(w.a.x + w.b.x) / 2}
                      y={(w.a.y + w.b.y) / 2 - 0.25}
                      fontSize=".15"
                      fill="#718077"
                      textAnchor="middle"
                      pointerEvents="none"
                    >
                      {units === "imperial" ? formatImperial(length(w)) : `${length(w).toFixed(1)} m`}
                    </text>
                    {selected === w.id &&
                      [w.a, w.b].map((pt, i) => (
                        <circle
                          key={i}
                          cx={pt.x}
                          cy={pt.y}
                          r=".085"
                          fill="#fff"
                          stroke="#46725d"
                          strokeWidth=".03"
                          onPointerDown={e => {
                            e.stopPropagation();
                            drag.current = { kind: "endpoint", id: w.id, end: i === 0 ? "a" : "b", point: point(e), base: plan };
                            svg.current?.setPointerCapture(e.pointerId);
                          }}
                        />
                      ))}
                  </g>
                ))}
                {plan.openings.map((o) => {
                  const w = plan.walls.find((w) => w.id === o.wallId)!;
                  const a = Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x),
                    x = w.a.x + Math.cos(a) * o.offset,
                    y = w.a.y + Math.sin(a) * o.offset;
                  return (
                    <g
                      key={o.id}
                      transform={`translate(${x} ${y}) rotate(${(a * 180) / Math.PI})`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelected(o.id);
                      }}
                    >
                      <rect
                        x="0"
                        y="-.12"
                        width={o.width}
                        height=".24"
                        fill={o.kind === "door" ? "#f2f3ed" : "#b8d4da"}
                        stroke={selected === o.id ? "#416953" : "#6b8d82"}
                        strokeWidth=".025"
                      />
                      {o.kind === "door" && (
                        <>
                          <line
                            x1="0"
                            y1="0"
                            x2="0"
                            y2={o.width}
                            stroke="#879387"
                            strokeWidth=".025"
                          />
                          <path
                            d={`M ${o.width} 0 A ${o.width} ${o.width} 0 0 1 0 ${o.width}`}
                            fill="none"
                            stroke="#879387"
                            strokeWidth=".018"
                          />
                        </>
                      )}
                    </g>
                  );
                })}
                {plan.furniture.map((f) => (
                  <g
                    data-testid="furniture"
                    key={f.id}
                    transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelected(f.id);
                      setTool("select");
                      drag.current = {
                        kind: "furniture",
                        id: f.id,
                        point: point(e),
                        base: plan,
                      };
                      svg.current?.setPointerCapture(e.pointerId);
                    }}
                  >
                    <rect
                      x={-f.width / 2}
                      y={-f.depth / 2}
                      width={f.width}
                      height={f.depth}
                      rx=".06"
                      fill={f.color}
                      stroke={f.id === selected ? "#36745b" : "#fff"}
                      strokeWidth={f.id === selected ? 0.045 : 0.025}
                    />
                    {f.kind === "sofa" && (
                      <>
                        <rect
                          x={-f.width / 2 + 0.12}
                          y={-f.depth / 2 + 0.14}
                          width={f.width - 0.24}
                          height={f.depth - 0.26}
                          rx=".05"
                          fill="none"
                          stroke="#fff8"
                          strokeWidth=".025"
                        />
                        {[-0.16, 0.16].map((x) => (
                          <line
                            key={x}
                            x1={f.width * x}
                            x2={f.width * x}
                            y1={-f.depth / 2 + 0.15}
                            y2={f.depth / 2 - 0.12}
                            stroke="#fff7"
                            strokeWidth=".025"
                          />
                        ))}
                      </>
                    )}
                    <text
                      x="0"
                      y=".05"
                      textAnchor="middle"
                      fontSize=".13"
                      fill="#ffffffdd"
                      pointerEvents="none"
                    >
                      {f.kind}
                    </text>
                  </g>
                ))}
                {start && cursor && (
                  <>
                    <circle cx={start.x} cy={start.y} r=".06" fill="#47705b" />
                    <line
                      x1={start.x}
                      y1={start.y}
                      x2={cursor.x}
                      y2={cursor.y}
                      stroke="#47705b"
                      strokeWidth=".06"
                      strokeDasharray=".12 .06"
                    />
                  </>
                )}
              </svg>
              <span className="canvas-floor-label">
                GROUND FLOOR <span>·</span> 1:100
              </span>
              <div className="canvas-controls">
                <button
                  aria-label="Zoom out"
                  onClick={() => setZoom(Math.max(0.05, zoom - 0.2))}
                >
                  <ZoomOut size={17} />
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button
                  aria-label="Zoom in"
                  onClick={() => setZoom(Math.min(3, zoom + 0.2))}
                >
                  <ZoomIn size={17} />
                </button>
              </div>
              <span className="north-indicator">
                ↑<small>N</small>
              </span>
              <div className="canvas-hint">
                {tool === "wall"
                  ? start
                    ? "Click the wall end point · Esc to cancel"
                    : "Click two points to draw a wall"
                  : tool === "door" || tool === "window"
                    ? "Click a wall to place your " + tool
                    : "Drag objects to move · Select an element to edit"}
                <span>SNAP {grid === "metric" ? "0.2 M" : grid === "inch" ? "1 IN" : grid === "six-inch" ? "6 IN" : "OFF"}</span>
              </div>
            </>
          ) : (
            <>
              <SceneView ref={scene} plan={plan} />
              <div className="scene-label">
                <span />
                LIVE 3D PREVIEW
              </div>
              <div className="scene-bottom">
                <span>Drag to orbit · Right-drag to pan · Scroll to zoom · Touch: one finger orbit, two fingers pan / pinch</span>
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() => {
                    try {
                      save(scene.current!.capture());
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                >
                  <Camera size={16} />
                  Capture for proposal
                </button>
              </div>
            </>
          )}
        </div>
        {inspector && (
          <aside className="studio-inspector">
            <div className="inspector-heading">
              <span className="eyebrow">MAKE IT YOURS</span>
              <h3>
                {wall
                  ? "Wall properties"
                  : furn
                    ? "Furniture properties"
                    : opening
                      ? "Opening properties"
                      : "The details matter."}
              </h3>
              <p>
                {selected
                  ? "Fine-tune your selected element."
                  : "Select an element or add something new."}
              </p>
            </div>
            {wall && (
              <div className="property-fields">
                {numberField(
                  "Start X",
                  wall.a.x,
                  (n) =>
                    change((p) => {
                      Object.assign(p, moveEndpoint(p, selected, "a", { ...p.walls.find(w => w.id === selected)!.a, x: n }));
                    }),
                  -100,
                )}
                {numberField(
                  "Start Y",
                  wall.a.y,
                  (n) =>
                    change((p) => {
                      Object.assign(p, moveEndpoint(p, selected, "a", { ...p.walls.find(w => w.id === selected)!.a, y: n }));
                    }),
                  -100,
                )}
                {numberField(
                  "End X",
                  wall.b.x,
                  (n) =>
                    change((p) => {
                      Object.assign(p, moveEndpoint(p, selected, "b", { ...p.walls.find(w => w.id === selected)!.b, x: n }));
                    }),
                  -100,
                )}
                {numberField(
                  "End Y",
                  wall.b.y,
                  (n) =>
                    change((p) => {
                      Object.assign(p, moveEndpoint(p, selected, "b", { ...p.walls.find(w => w.id === selected)!.b, y: n }));
                    }),
                  -100,
                )}
                {numberField(
                  "Wall height",
                  wall.height,
                  (n) =>
                    change((p) => {
                      p.walls.find((w) => w.id === selected)!.height = n;
                    }),
                  0.2,
                  10,
                )}
                {numberField(
                  "Thickness",
                  wall.thickness,
                  (n) =>
                    change((p) => {
                      p.walls.find((w) => w.id === selected)!.thickness = n;
                    }),
                  0.05,
                  1,
                )}
              </div>
            )}
            {furn && (
              <div className="property-fields">
                {numberField(
                  "Position X",
                  furn.x,
                  (n) =>
                    change((p) => {
                      p.furniture.find((f) => f.id === selected)!.x = n;
                    }),
                  -100,
                )}
                {numberField(
                  "Position Y",
                  furn.y,
                  (n) =>
                    change((p) => {
                      p.furniture.find((f) => f.id === selected)!.y = n;
                    }),
                  -100,
                )}
                {numberField(
                  "Width",
                  furn.width,
                  (n) =>
                    change((p) => {
                      p.furniture.find((f) => f.id === selected)!.width = n;
                    }),
                  0.1,
                )}
                {numberField(
                  "Depth",
                  furn.depth,
                  (n) =>
                    change((p) => {
                      p.furniture.find((f) => f.id === selected)!.depth = n;
                    }),
                  0.1,
                )}
                {numberField(
                  "Height",
                  furn.height,
                  (n) =>
                    change((p) => {
                      p.furniture.find((f) => f.id === selected)!.height = n;
                    }),
                  0.1,
                )}
                {numberField(
                  "Rotation",
                  furn.rotation,
                  (n) =>
                    change((p) => {
                      p.furniture.find((f) => f.id === selected)!.rotation = n;
                    }),
                  -360,
                  360,
                )}
              </div>
            )}
            {opening && (
              <div className="property-fields">
                {numberField("Along wall", opening.offset, (n) =>
                  change((p) => {
                    p.openings.find((o) => o.id === selected)!.offset = n;
                  }),
                )}
                {numberField(
                  "Opening width",
                  opening.width,
                  (n) =>
                    change((p) => {
                      p.openings.find((o) => o.id === selected)!.width = n;
                    }),
                  0.2,
                )}
                {numberField(
                  "Opening height",
                  opening.height,
                  (n) =>
                    change((p) => {
                      p.openings.find((o) => o.id === selected)!.height = n;
                    }),
                  0.2,
                )}
                {numberField("Sill height", opening.sill, (n) =>
                  change((p) => {
                    p.openings.find((o) => o.id === selected)!.sill = n;
                  }),
                )}
              </div>
            )}
            {(wall || furn) && (
              <label className="color-field">
                Material color
                <input
                  aria-label="Material color"
                  type="color"
                  value={(wall || furn)!.color}
                  onChange={(e) =>
                    change((p) => {
                      const obj =
                        p.walls.find((w) => w.id === selected) ||
                        p.furniture.find((f) => f.id === selected);
                      if (obj) obj.color = e.target.value;
                    })
                  }
                />
              </label>
            )}
            {selected && (
              <button className="delete-element" onClick={remove}>
                <Trash2 size={14} />
                Delete selected element
              </button>
            )}
            <div className="inspector-section">
              <div className="inspector-section-title">
                <Armchair size={16} />
                <h4>Furniture collection</h4>
                <span>08</span>
              </div>
              <select aria-label="Furniture category" value={category} onChange={e => setCategory(e.target.value)}>{["Living", "Bedroom", "Kitchen", "Decor"].map(c => <option key={c}>{c}</option>)}</select>
              <div className="furniture-library">
                {(({Living: ["sofa", "table", "chair"], Bedroom: ["bed"], Kitchen: ["cabinet", "refrigerator", "oven"], Decor: ["plant"]} as Record<string, Furniture["kind"][]>)[category]).map(
                  (kind) => (
                    <button
                      key={kind}
                      aria-label={"Add " + kind}
                      onClick={() => add(kind)}
                    >
                      <span className={"furniture-swatch " + kind}>
                        {kind === "sofa"
                          ? "▰"
                          : kind === "table"
                            ? "▱"
                            : kind === "bed"
                              ? "▤"
                              : kind === "plant"
                                ? "♣"
                                : "▥"}
                      </span>
                      <span>{kind[0].toUpperCase() + kind.slice(1)}</span>
                      <Plus size={13} />
                    </button>
                  ),
                )}
              </div>
            </div>
            <div className="inspector-section">
              <h4>Floor finish</h4>
              <div className="material-swatches">
                {[
                  ["#d7c5a8", "Natural oak"],
                  ["#b8ada0", "Warm stone"],
                  ["#e9e5db", "Soft limestone"],
                  ["#756959", "Smoked oak"],
                ].map(([c, l]) => (
                  <button
                    key={c}
                    title={l}
                    aria-label={l}
                    className={plan.floorColor === c ? "selected" : ""}
                    style={{ background: c }}
                    onClick={() =>
                      change((p) => {
                        p.floorColor = c;
                      })
                    }
                  />
                ))}
              </div>
            </div>
            <div className="version-tools">
              <h4>Saved design versions</h4>
              <p>Versions snapshot the saved plan and image. Save your edits first.</p>
              <input aria-label="Version name" maxLength={100} placeholder="Version name" value={versionLabel} onChange={e => setVersionLabel(e.target.value)} />
              <button disabled={dirty || busy} onClick={createVersion}>Create saved version</button>
              <select aria-label="Saved design version" value={before?.id || ""} onChange={e => chooseVersion(e.target.value)}>
                <option value="">Choose a version</option>
                {versions.map(v => <option key={v.id} value={v.id}>{v.label} · revision {v.project_revision}</option>)}
              </select>
              {before && <>
                <button onClick={() => setComparison(!comparison)}>{comparison ? "Return to editing" : "Compare before / current"}</button>
                <button disabled={busy} onClick={() => { if(commit(structuredClone(before.plan))) { setComparison(false); setSelected(""); setMessage("Version restored locally — save to apply"); } }}>Restore as unsaved edit</button>
                <small>Restore is undoable and requires Save design.</small>
              </>}
            </div>
            <div className="inspector-note">
              <Box size={17} />
              <p>
                Every edit in 2D is reflected in your 3D view. One plan, always
                connected.
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function PlanPreview({plan}: {plan:Plan}) {
  const points = plan.walls.flatMap(w => [w.a,w.b]);
  const minX=Math.min(0,...points.map(p=>p.x)), minY=Math.min(0,...points.map(p=>p.y));
  const width=Math.max(1,...points.map(p=>p.x-minX)), height=Math.max(1,...points.map(p=>p.y-minY));
  return <svg role="img" aria-label="Read-only floor plan" viewBox={`${minX-1} ${minY-1} ${width+2} ${height+2}`} style={{width:"100%", flex:1, background:"#f2f3ed"}}>
    {measurePlan(plan).rooms.map(r=><polygon key={r.id} points={r.polygon.map(p=>`${p.x},${p.y}`).join(" ")} fill={plan.floorColor} />)}
    {plan.walls.map(w=><line key={w.id} x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke={w.color} strokeWidth={w.thickness} />)}
    {plan.openings.map(o=> {const w=plan.walls.find(w=>w.id===o.wallId)!;const angle=Math.atan2(w.b.y-w.a.y,w.b.x-w.a.x);return <line key={o.id} x1={w.a.x+Math.cos(angle)*o.offset} y1={w.a.y+Math.sin(angle)*o.offset} x2={w.a.x+Math.cos(angle)*(o.offset+o.width)} y2={w.a.y+Math.sin(angle)*(o.offset+o.width)} stroke={o.kind==="door"?"#f2f3ed":"#8bbbc4"} strokeWidth={w.thickness+.02} />;})}
    {plan.furniture.map(f=><rect key={f.id} x={-f.width/2} y={-f.depth/2} width={f.width} height={f.depth} fill={f.color} transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`} />)}
  </svg>;
}
