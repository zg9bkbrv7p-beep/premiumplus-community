import ProjectOverview, {stageLabel} from "./ProjectOverview";
import PhotoRemodel from "../remodel/PhotoRemodel";
import LiveProject from "./LiveProject";
import { Estimator } from "../estimating/Estimator";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Camera,
  ArrowUpRight,
  PenTool,
  Box,
  FileText,
  Activity,
  LayoutGrid,
  ArrowRight,
  Link,
  MessageSquare,
  Check,
  Clock,
  Copy,
  Trash2,
} from "lucide-react";
import { api, type Project, date, money } from "../api";
import { Empty, Field, Modal } from "../ui";
import PlanLab from "../planlab/PlanLab";
import Studio from "../design/Studio";
import ProposalEditor from "../proposals/Editor";
import { PropertyPhotoCover } from "./Workspace";
export default function ProjectPage({
  project: initial,
  initialTab,
  onBack,
  onProject,
  dirty,
  onDirty,
}: {
  project: Project;
  initialTab: string;
  onBack: () => void;
  onProject: (p: Project) => void;
  dirty: boolean;
  onDirty: (dirty: boolean) => void;
}) {
  const [p, setP] = useState(initial),
    [tab, updateTab] = useState(initialTab),
    [error, setError] = useState(""),
    [reply, setReply] = useState(""),
    [proposalSelection, setProposalSelection] = useState<string | undefined>(),
    [replyBusy, setReplyBusy] = useState(false),
    [editing, setEditing] = useState(false),
    [editBusy, setEditBusy] = useState(false),
    [confirmArchive,setConfirmArchive]=useState(false),
    [trashConfirmation,setTrashConfirmation]=useState(''),
    [measuredWallFeet,setMeasuredWallFeet]=useState<number|null>(null);
  async function moveToTrash(){
    setEditBusy(true);setError('');
    try{await api(`/projects/${p.id}/trash`,'POST',{confirmName:trashConfirmation});setEditing(false);onBack();}
    catch(e:any){setError(e.message);}finally{setEditBusy(false);}
  }
  async function changeArchive(archived:boolean){
    setEditBusy(true);setError("");
    try{const next=await api<Project>(`/projects/${p.id}/archive`,"PATCH",{archived,expectedArchived:!!p.archivedAt});setP(prev=>({...prev,...next}));onProject({...p,...next});setEditing(false);setConfirmArchive(false);onBack();}
    catch(e:any){setError(e.message);}finally{setEditBusy(false);}
  }
  function setTab(next: string) {
    if (next === tab) return true;
    if (
      dirty &&
      !window.confirm("You have unsaved changes. Leave without saving?")
    )
      return false;
    onDirty(false);
    updateTab(next);
    const url = new URL(location.href);
    url.searchParams.set("tab", next);
    history.replaceState(null, "", url.pathname + url.search);
    return true;
  }
  async function reload() {
    const next = await api<Project>("/projects/" + p.id);
    setP(next);
    return next;
  }
  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, []);
  async function update(next: Project) {
    setP((prev) => ({ ...prev, ...next }));
  }
  return (
    <>
      <div className={"project-heading" + (tab === "remodel" ? " photo-project-heading" : "")}>
        <button className="back-link" onClick={onBack}>
          <ArrowLeft size={15} />
          All projects
        </button>
        <div className="project-title-line">
          <div>
            <span className="eyebrow">PRIVATE PROJECT / CONTRACTOR WORKSPACE</span>
            <h1>{p.name}</h1>
            <p>{p.address || "A new space, ready to take shape"}</p>
          </div>
          <button
            className="btn secondary edit-details"
            aria-label="Edit project details"
            disabled={dirty}
            title={
              dirty
                ? "Save your work before editing project details"
                : "Edit project details"
            }
            onClick={() => {
              setError("");
              setConfirmArchive(false);setEditing(true);
            }}
          >
            Edit details
          </button>
          <span
            className={
              "project-status static " +
              (p.agreements?.length ? "accepted" : "")
            }
          >
            {stageLabel(p)}
          </span>
        </div>
      </div>
      {p.archivedAt&&<p className="project-archive-notice"><strong>Archived project</strong> · Preserved in your archive. Restore it from Edit details.</p>}
      <nav className="project-tabs project-primary-tabs" aria-label="Project navigation">
        {[
          ["overview", LayoutGrid, "Overview"],
          ["remodel", Camera, "Photo Preview"],
          ["proposal", FileText, "Proposal"],
          ["live", Activity, "Live Project"],
          ["documents", FileText, "Documents"],
        ].map(([k, Icon, label]: any) => (
          <button
            key={k}
            aria-current={tab === k || (["planlab","estimate","activity","design"].includes(tab) && k === "overview") ? "page" : undefined}
            className={tab === k || (["planlab","estimate","activity","design"].includes(tab) && k === "overview") ? "active" : ""}
            onClick={() => {
              if (setTab(k) && (k === "activity" || k === "overview"))
                reload().catch((e) => setError(e.message));
            }}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>
      {error && <div className="error">{error}</div>}
      {tab === "planlab" ? (
        <div className="advanced-plan-wrapper"><button className="back-link" onClick={()=>setTab("overview")}><ArrowLeft size={15}/> Back to Project Overview</button><PlanLab project={p} onMakeWall={(feet)=>{setMeasuredWallFeet(feet);setTab('design');}} /></div>
      ) : tab === "design" ? (
        <div className="advanced-plan-wrapper">
          <button className="back-link" onClick={()=>setTab("overview")}><ArrowLeft size={15}/> Back to Project Overview</button>
          <Studio key={p.id} project={p} initialMeasuredWallFeet={measuredWallFeet ?? undefined} onSaved={update} onDirty={onDirty}/>
        </div>
      ) : tab === "remodel" ? (
        <PhotoRemodel
          project={p}
          onDirty={onDirty}
          onAdvanced={() => setTab("planlab")}
          onProposal={async (id) => {
            await reload();
            setProposalSelection(id);
            setTab("proposal");
          }}
        />
      ) : tab === "estimate" ? (
        <><button className="back-link tool-back" onClick={()=>setTab("overview")}><ArrowLeft size={15}/> Back to Project Overview</button><Estimator
          project={p}
          onDirty={onDirty}
          onProposal={() => {
            reload().catch((e) => setError(e.message));
            setTab("proposal");
          }}
        /></>
      ) : tab === "documents" ? (
        <LiveProject projectId={p.id} documentsOnly />
      ) : tab === "live" ? (
        <LiveProject projectId={p.id} />
      ) : tab === "proposal" ? (
        <ProposalEditor
          key={proposalSelection || "latest"}
          initialProposalId={proposalSelection}
          project={p}
          onChange={reload}
          onDirty={onDirty}
        />
      ) : (
        <div className={tab === "overview" ? "overview-wrapper" : "project-content"}>
          {tab === "overview" ? (
            <ProjectOverview project={p} onTab={setTab} onEdit={()=>{setError("");setConfirmArchive(false);setEditing(true);}} />
          ) : (
            <div className="activity-layout">
              <section className="panel">
                <span className="eyebrow">THE PROJECT STORY</span>
                <h2>Every step, connected.</h2>
                <div className="activity-list">
                  {p.events?.map((e) => (
                    <div key={e.id}>
                      <span className="timeline-dot">
                        <Check size={12} />
                      </span>
                      <div>
                        <strong>{e.label}</strong>
                        <small>{new Date(e.created_at).toLocaleString()}</small>
                      </div>
                    </div>
                  ))}
                </div>
                {p.agreements?.map((a) => (
                  <div className="acceptance-card" key={a.id}>
                    <Check />
                    <h3>Agreement accepted</h3>
                    <p>
                      {a.name} · {date(a.acceptedAt)} · {money(a.total)}
                    </p>
                    <small>Verification SHA-256</small>
                    <code>{a.sha256}</code>
                    <button
                      className="btn secondary"
                      onClick={() => {
                        const url = URL.createObjectURL(
                          new Blob([JSON.stringify(a, null, 2)], {
                            type: "application/json",
                          }),
                        );
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = "agreement-" + a.id + ".json";
                        link.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Download agreement
                    </button>
                  </div>
                ))}
              </section>
              <div className="activity-side">
                <section className="panel">
                  <h3>
                    <Link size={17} /> Client links
                  </h3>
                  <p className="muted">
                    Private links expire after 7 days. Revoking a link ends its
                    client access.
                  </p>
                  {p.shares?.length ? (
                    p.shares.map((s) => (
                      <div className="share-row" key={s.id}>
                        <span
                          className={
                            "status-dot " + (s.revoked ? "inactive" : "")
                          }
                        />
                        <div>
                          <strong>
                            {s.revoked
                              ? "Revoked"
                              : Date.now() > s.expires
                                ? "Expired"
                                : "Active link"}
                          </strong>
                          <small>Created {date(s.created_at)}</small>
                        </div>
                        {!s.revoked && (
                          <button
                            className="text-danger"
                            onClick={async () => {
                              try {
                                await api(
                                  `/projects/${p.id}/shares/${s.id}`,
                                  "DELETE",
                                );
                                await reload();
                              } catch (e: any) {
                                setError(e.message);
                              }
                            }}
                          >
                            Revoke link
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="muted">
                      Share a proposal to create a client link.
                    </p>
                  )}
                </section>
                <section className="panel">
                  <h3>
                    <MessageSquare size={18} /> Project conversation
                  </h3>
                  <div className="comments">
                    {p.comments?.length ? (
                      p.comments.map((c) => (
                        <div key={c.id} className="comment">
                          <strong>
                            {c.author}
                            <small>{date(c.created_at)}</small>
                          </strong>
                          <p>{c.body}</p>
                        </div>
                      ))
                    ) : (
                      <p className="muted">
                        A shared place for questions and ideas. Comments do not
                        change the agreement.
                      </p>
                    )}
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setReplyBusy(true);
                      try {
                        await api(`/projects/${p.id}/comments`, "POST", {
                          body: reply,
                        });
                        setReply("");
                        await reload();
                      } catch (e: any) {
                        setError(e.message);
                      } finally {
                        setReplyBusy(false);
                      }
                    }}
                  >
                    <label className="field">
                      <span>Your reply</span>
                      <textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        required
                        maxLength={4000}
                        placeholder="Keep the conversation moving…"
                      />
                    </label>
                    <button className="btn secondary" disabled={replyBusy}>
                      Post reply <ArrowRight size={15} />
                    </button>
                  </form>
                </section>
              </div>
            </div>
          )}
        </div>
      )}

      {editing && (
        <Modal
          title="A few details, thoughtfully updated."
          onClose={() => setEditing(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              setEditBusy(true);
              try {
                const next = await api<Project>("/projects/" + p.id, "PATCH", {
                  revision: p.revision,
                  ...values,
                });
                setP((prev) => ({ ...prev, ...next }));
                onProject(next);
                setEditing(false);
                setError("");
              } catch (e: any) {
                setError(e.message);
              } finally {
                setEditBusy(false);
              }
            }}
          >
            <Field
              label="Project name"
              name="name"
              defaultValue={p.name}
              required
              maxLength={200}
            />
            <Field
              label="Site address"
              name="address"
              defaultValue={p.address}
              maxLength={400}
            />
            <label className="field">
              <span>A little about the project</span>
              <textarea
                name="description"
                defaultValue={p.description}
                maxLength={5000}
              />
            </label>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <button className="btn primary full" disabled={editBusy}>
              Save project details
            </button>
          </form>
          {p.canArchive&&<section className="project-archive-controls" aria-label="Project archive">
            <h3>{p.archivedAt?'Restore this project':'Archive this project'}</h3>
            <p>Hide it from the active contractor list. Proposals, contracts, photos and history stay saved. Existing homeowner access stays unchanged.</p>
            {p.archivedAt?<button type="button" className="btn secondary" disabled={editBusy} onClick={()=>changeArchive(false)}>Restore Project</button>:confirmArchive?<div><p>Archive “{p.name}”?</p><button type="button" className="btn secondary" disabled={editBusy} onClick={()=>setConfirmArchive(false)}>Cancel archive</button><button type="button" className="btn primary" disabled={editBusy} onClick={()=>changeArchive(true)}>Confirm archive</button></div>:<button type="button" className="btn secondary" disabled={editBusy} onClick={()=>setConfirmArchive(true)}>Archive Project</button>}
          </section>}
          {p.canArchive&&!p.agreements?.length&&<section className="project-trash-controls" aria-label="Project trash">
            <h3><Trash2 size={17}/> Move draft to Trash</h3>
            <p>Remove this unsigned draft from your project list. This is reversible. Shared proposal links will stop working, and all records will be preserved for recovery.</p>
            <label className="field"><span>Type the exact project name: {p.name}</span><input aria-label="Confirm draft project name" value={trashConfirmation} onChange={e=>setTrashConfirmation(e.target.value)} autoComplete="off" /></label>
            <button type="button" className="btn project-trash-button" disabled={editBusy||dirty||trashConfirmation!==p.name} onClick={()=>void moveToTrash()}><Trash2 size={16}/> Move to Trash</button>
          </section>}
          {!!p.agreements?.length&&<p className="muted">Signed agreements cannot be deleted; use Archive Project to hide this record while preserving the contract.</p>}
        </Modal>
      )}
    </>
  );
}
