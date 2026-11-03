import PdfImport from "./pdf/PdfImport";
import { applyPdfImport } from "../../shared/pdfImport";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  ArrowRight,
  ArrowUpRight,
  Eye,
  Save,
  Link,
  Copy,
  Check,
  FileText,
  Image,
  Trash2,
  Lock,
  RefreshCw,
} from "lucide-react";
import { api, type Project, type Proposal, money } from "../api";
import {
  defaultProposal,
  validateProposal,
  calculateTotal,
  type ProposalData,
  type Line,
} from "../../shared/proposal";
import { Modal, Field, Empty } from "../ui";
import Presentation from "./Presentation";
import{proposalReadiness}from'../../shared/proposalReadiness';
export default function ProposalEditor({
  project,
  onChange,
  onDirty,
  initialProposalId,
}: {
  project: Project;
  onChange: () => Promise<Project>;
  onDirty: (dirty: boolean) => void;
  initialProposalId?: string;
}) {
  const [importing, setImporting] = useState(false);
  const [company, setCompany] = useState("Your studio");
  useEffect(() => {
    api("/company")
      .then((c) => setCompany(c.name))
      .catch(() => {});
  }, []);
  const [prop, setProp] = useState<Proposal | null>(
      project.proposals?.find((p) => p.id === initialProposalId) ||
        project.proposals?.[0] ||
        null,
    ),
    [data, setData] = useState<ProposalData>(
      prop || defaultProposal(project.name),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(false),
    [link, setLink] = useState(""),
    [saved, setSaved] = useState(""),
    [copied, setCopied] = useState(false),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    onDirty(dirty);
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, onDirty]);
  useEffect(() => {
    if (!prop && project.proposals?.length) {
      setProp(project.proposals[0]);
      setData(project.proposals[0]);
    }
  }, [project.proposals]);
  const edits = useRef(0);
  const latest = useRef({ data, prop });
  latest.current = { data, prop };
  function previewProposal() {
    try {
      validateProposal(data);
      setPreview(true);
      setError("");
    } catch {
      setError(
        "Check your line quantities, prices, and required proposal fields before previewing.",
      );
    }
  }
  const locked = prop && prop.status !== "draft";
  const readinessIssues=proposalReadiness(data,project.address);
  function update<K extends keyof ProposalData>(
    key: K,
    value: ProposalData[K],
  ) {
    edits.current++;
    setData({ ...data, [key]: value, ...((key==='items'||key==='options')?{pricingReviewed:false}:{}) });
    setDirty(true);
    setSaved("");
    setError("");
  }
  async function create() {
    setBusy(true);
    try {
      const d = {
        ...defaultProposal(project.name),
        designImage: "",
      };
      const p = await api<Proposal>(
        `/projects/${project.id}/proposals`,
        "POST",
        d,
      );
      setProp(p);
      setData(p);
      await onChange();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!prop) return;
    const submittedEdit = edits.current;
    const next = await api<Proposal>(
      `/projects/${project.id}/proposals/${prop.id}`,
      "PATCH",
      { ...data, revision: prop.revision },
    );
    setProp(next);
    const newerEdits = edits.current !== submittedEdit;
    if (!newerEdits) setData(next);
    setSaved(newerEdits ? "New edits not saved" : "Proposal saved");
    setDirty(newerEdits);
    await onChange();
    return next;
  }
  async function act(fn: () => Promise<any>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!prop) return;
    if(readinessIssues.length)throw Error('Before sharing: '+readinessIssues.map(i=>i.message).join(' '));
    const submittedEdit = edits.current;
    const current = prop.status === "draft" ? await save() : prop;
    if (edits.current !== submittedEdit)
      throw Error(
        "Your proposal changed while saving. Save the new edits before sharing.",
      );
    const r = await api(`/projects/${project.id}/shares`, "POST", {
      proposalId: current!.id,
    });
    setProp({ ...current!, status: "shared" });
    setLink(location.origin + "/client#share=" + r.token);
    await onChange();
  }
  function lineEditor(kind: "items" | "options") {
    return (
      <div className="editor-lines">
        {data[kind].map((item, i) => (
          <div key={item.id} className="editor-line">
            <label>
              <span>
                {kind === "items" ? "Item description" : "Option description"}
              </span>
              <input
                aria-label={`${kind} description ${i + 1}`}
                value={item.label}
                disabled={!!locked}
                maxLength={200}
                onChange={(e) =>
                  update(
                    kind,
                    data[kind].map((x) =>
                      x.id === item.id ? { ...x, label: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              <span>Qty</span>
              <input
                aria-label={`${kind} quantity ${i + 1}`}
                type="number"
                min="1"
                step="1"
                max="100000"
                disabled={!!locked}
                value={item.quantity}
                onChange={(e) =>
                  update(
                    kind,
                    data[kind].map((x) =>
                      x.id === item.id
                        ? { ...x, quantity: Number(e.target.value) }
                        : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              <span>Unit price ($)</span>
              <input
                aria-label={`${kind} price ${i + 1}`}
                type="number"
                min="0"
                step=".01"
                disabled={!!locked}
                value={item.price / 100}
                onChange={(e) =>
                  update(
                    kind,
                    data[kind].map((x) =>
                      x.id === item.id
                        ? {
                            ...x,
                            price: Math.round(Number(e.target.value) * 100),
                          }
                        : x,
                    ),
                  )
                }
              />
            </label>
            <button
              className="icon-btn danger"
              aria-label={"Remove " + item.label}
              disabled={!!locked}
              onClick={() =>
                update(
                  kind,
                  data[kind].filter((x) => x.id !== item.id),
                )
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {!locked && (
          <button
            className="text-btn"
            onClick={() =>
              update(kind, [
                ...data[kind],
                {
                  id: crypto.randomUUID(),
                  label:
                    kind === "items"
                      ? "New project item"
                      : "New optional upgrade",
                  quantity: 1,
                  price: 0,
                },
              ])
            }
          >
            <Plus size={15} />
            Add {kind === "items" ? "line item" : "optional upgrade"}
          </button>
        )}
      </div>
    );
  }
  let total = 0;
  try {
    total = calculateTotal(data.items, data.options, []);
  } catch {}
  return (
    <div className="proposal-workspace">
      {importing && prop && !locked && (
        <PdfImport
          key={prop.id}
          projectId={project.id}
          proposal={prop}
          current={data}
          onClose={() => setImporting(false)}
          onApply={(review, selection) => {
            const active = latest.current;
            if (
              !active.prop ||
              active.prop.id !== prop.id ||
              active.prop.status !== "draft" ||
              active.prop.revision !== prop.revision
            )
              throw Error(
                "Proposal changed. Reopen import for the current draft.",
              );
            const next = applyPdfImport(active.data, review, selection);
            edits.current++;
            setData({...next,pricingReviewed:false});
            setDirty(true);
            setSaved("PDF applied — save proposal to keep changes");
            setError("");
          }}
        />
      )}

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!prop ? (
        <div className="proposal-start">
          <div className="proposal-start-image">
            <div>
              <span className="eyebrow">YOUR NEXT GREAT FIRST IMPRESSION</span>
              <h2>
                A proposal that feels
                <br />
                like a possibility.
              </h2>
            </div>
          </div>
          <div className="proposal-start-copy">
            <span className="eyebrow">FROM VISION TO A SHARED YES</span>
            <h2>
              Present beautifully.
              <br />
              Move forward clearly.
            </h2>
            <p>
              Bring your design, scope, and pricing together in a thoughtful
              client experience. No attachments. No guesswork.
            </p>
            <ul>
              <li>
                <Check size={16} />
                Your design, front and center
              </li>
              <li>
                <Check size={16} />
                Transparent pricing and optional upgrades
              </li>
              <li>
                <Check size={16} />
                Private sharing and recorded acceptance
              </li>
            </ul>
            <button className="btn primary" onClick={create} disabled={busy}>
              Create proposal <ArrowRight size={17} />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="proposal-editor-top">
            <div>
              <span className="eyebrow">YOUR PROPOSAL WORKSPACE</span>
              <h2>Make your vision clear.</h2>
            </div>
            <div className="proposal-buttons">
              {!locked && (
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => setImporting(true)}
                >
                  <FileText size={16} />
                  Import PDF
                </button>
              )}

              {saved && (
                <span className="saved-label">
                  <Check size={14} />
                  {saved}
                </span>
              )}
              <button className="btn secondary" onClick={previewProposal}>
                <Eye size={16} />
                Preview
              </button>
              {!locked && (
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => act(save)}
                >
                  <Save size={16} />
                  Save proposal
                </button>
              )}
              {prop.status !== "accepted" && (
                <button
                  className="btn primary"
                  disabled={busy||readinessIssues.length>0}
                  onClick={() => act(share)}
                >
                  <ArrowUpRight size={16} />
                  Share with client
                </button>
              )}
            </div>
          </div>
          {prop.status==='draft'&&<section className="panel" aria-label="Proposal sharing checklist" style={{marginBottom:20}}><strong>{readinessIssues.length?'Before sharing':'Ready to share'}</strong>{readinessIssues.length?<><ul>{readinessIssues.map(i=><li key={i.key}>{i.message}</li>)}</ul><p className="muted">You can save this draft while you complete these details.</p></>:<p className="muted">Homeowner details, scope and pricing have been checked.</p>}</section>}
          {locked && (
            <div className="locked-notice">
              <Lock size={18} />
              <div>
                <strong>
                  {prop.status === "accepted"
                    ? "This proposal has been accepted."
                    : "This proposal has been shared."}
                </strong>
                <p>
                  Its scope and pricing are preserved. Create a new revision to
                  make changes.
                </p>
              </div>
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    const p = await api<Proposal>(
                      `/projects/${project.id}/proposals/${prop.id}/revise`,
                      "POST",
                      {},
                    );
                    setProp(p);
                    setData(p);
                    setSaved("New draft revision");
                    await onChange();
                  })
                }
              >
                <RefreshCw size={15} />
                New revision
              </button>
            </div>
          )}
          {(project.proposals?.length || 0) > 1 && (
            <label className="revision-picker">
              Proposal versions
              <select
                aria-label="Proposal version"
                disabled={busy}
                value={prop.id}
                onChange={(e) => {
                  if (
                    dirty &&
                    !window.confirm(
                      "You have unsaved proposal changes. Switch versions without saving?",
                    )
                  )
                    return;
                  setDirty(false);
                  const p = project.proposals!.find(
                    (p) => p.id === e.target.value,
                  )!;
                  setProp(p);
                  setData(p);
                  setSaved("");
                }}
              >
                {project.proposals?.map((p, i) => (
                  <option key={p.id} value={p.id}>
                    {i === 0 ? "Latest" : "Earlier"} · {p.status} · {p.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="proposal-editor-grid">
            <div>
              <section className="panel editor-section">
                <div className="editor-section-label">
                  <span>01</span>
                  <h3>The first impression</h3>
                </div>
                <Field
                  label="Proposal title"
                  value={data.title}
                  disabled={!!locked}
                  onChange={(e) => update("title", e.target.value)}
                  maxLength={200}
                />
                <Field label="Homeowner name" value={data.customerName||''} disabled={!!locked} onChange={e=>update('customerName',e.target.value)} maxLength={120}/>
                <Field label="Homeowner email or phone" value={data.customerContact||''} disabled={!!locked} onChange={e=>update('customerContact',e.target.value)} maxLength={200}/>
                <p className="muted">Property: {project.address||'Add the address using Edit Details above.'}</p>
                <label className="field">
                  <span>Scope of work</span>
                  <textarea
                    aria-label="Scope of work"
                    value={data.scope}
                    disabled={!!locked}
                    onChange={(e) => update("scope", e.target.value)}
                    maxLength={20000}
                    rows={5}
                  />
                </label>
                <div className="proposal-image-field">
                  {data.designImage ? (
                    <img src={data.designImage} alt="Proposal design image" />
                  ) : (
                    <div>
                      <Image size={24} />
                      <p>
                        Use Photo Preview to create a concept image for your proposal.
                      </p>
                    </div>
                  )}
                </div>
              </section>
              <section className="panel editor-section">
                <div className="editor-section-label">
                  <span>02</span>
                  <h3>A clear investment</h3>
                </div>
                {lineEditor("items")}
                <div className="editor-subtotal">
                  <span>Base project investment</span>
                  <strong>{money(total)}</strong>
                </div>
                <label className="consent-check"><input type="checkbox" checked={!!data.pricingReviewed} disabled={!!locked} onChange={e=>update('pricingReviewed',e.target.checked)}/><span>I checked the quantities and pricing for this project.</span></label>
                <div className="optional-heading">
                  <span className="eyebrow">A LITTLE MORE POSSIBILITY</span>
                  <h4>Optional upgrades</h4>
                  <p>Your client can add these before accepting.</p>
                </div>
                {lineEditor("options")}
              </section>
              <section className="panel editor-section">
                <div className="editor-section-label">
                  <span>03</span>
                  <h3>The details that matter</h3>
                </div>
                <label className="field">
                  <span>Schedule</span>
                  <textarea
                    value={data.schedule}
                    disabled={!!locked}
                    onChange={(e) => update("schedule", e.target.value)}
                    maxLength={2000}
                  />
                </label>
                <label className="field">
                  <span>Terms & conditions</span>
                  <textarea
                    value={data.terms}
                    disabled={!!locked}
                    onChange={(e) => update("terms", e.target.value)}
                    maxLength={20000}
                    rows={5}
                  />
                </label>
              </section>
            </div>
            <aside className="proposal-summary panel">
              <span className="eyebrow">BEFORE YOU HIT SEND</span>
              <h3>A considered proposal.</h3>
              <div className="summary-cover">
                {data.designImage ? <img src={data.designImage} alt="Proposal cover preview" /> : <div className="neutral-project-cover" role="img" aria-label="No project photo selected" />}
                <strong>{project.name}</strong>
              </div>
              <div className="summary-list">
                <span>
                  Project scope<strong>{data.items.length} items</strong>
                </span>
                <span>
                  Optional upgrades
                  <strong>{data.options.length} options</strong>
                </span>
                <span>
                  Status<strong className="capitalize">{prop.status}</strong>
                </span>
              </div>
              <div className="summary-total">
                <span>BASE INVESTMENT</span>
                <strong>{money(total)}</strong>
              </div>
              <p className="muted">
                Sharing locks this version. Any later changes become a new
                revision.
              </p>
              <button className="btn secondary full" onClick={previewProposal}>
                See the client experience <ArrowUpRight size={16} />
              </button>
            </aside>
          </div>
        </>
      )}
      {preview && (
        <Modal
          title="Your client’s first impression."
          onClose={() => setPreview(false)}
        >
          <Presentation
            proposal={data}
            project={project}
            company={company}
            agreement={project.agreements?.find(
              (a) => a.snapshot.proposalId === prop?.id,
            )}
            onPrint={false}
          />
        </Modal>
      )}
      {link && (
        <Modal title="A vision worth sharing." onClose={() => setLink("")}>
          <div className="share-modal-icon">
            <Link size={26} />
          </div>
          <p>
            Send this private link directly to your client. They can explore the
            design, select upgrades, and accept your proposal.
          </p>
          <Field label="Private client link" value={link} readOnly />
          <button
            className="btn primary full"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                setError("Select the link above to copy it manually.");
              }
            }}
          >
            {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
            {copied ? "Link copied" : "Copy private link"}
          </button>
          <a
            className="share-preview-link"
            href={link}
            target="_blank"
            rel="noopener"
          >
            Open client view in a separate browser profile{" "}
            <ArrowUpRight size={15} />
          </a>
          <p className="share-warning">
            Expires in 7 days. Anyone with this link can view and accept this
            proposal. Use a separate browser profile to keep your contractor
            session.
          </p>
        </Modal>
      )}
    </div>
  );
}
