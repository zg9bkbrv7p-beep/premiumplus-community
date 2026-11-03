import { useEffect, useRef, useState } from "react";
import { api, type Proposal } from "../../api";
import { Modal } from "../../ui";
import {
  applyPdfImport,
  sectionNames,
  type SectionKey,
  type PdfReview,
} from "../../../shared/pdfImport";
import type { ProposalData } from "../../../shared/proposal";
import "./pdf.css";
export default function PdfImport({
  projectId,
  proposal,
  current,
  onApply,
  onClose,
}: {
  projectId: string;
  proposal: Proposal;
  current: ProposalData;
  onApply: (
    review: PdfReview,
    selection: { sections: SectionKey[]; items: number[] },
  ) => void;
  onClose: () => void;
}) {
  const [review, setReview] = useState<PdfReview | null>(null),
    [source, setSource] = useState<{ name: string; base64: string } | null>(
      null,
    ),
    [sections, setSections] = useState<SectionKey[]>([]),
    [items, setItems] = useState<number[]>([]),
    [busy, setBusy] = useState(false),
    [applying, setApplying] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(true);
  const attempt = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      attempt.current++;
    };
  }, []);
  async function upload(file: File) {
    const sequence = ++attempt.current;
    setError("");
    setReview(null);
    setSource(null);
    setSections([]);
    setItems([]);
    setBusy(true);
    try {
      if (file.size > 8 * 1024 * 1024 || !file.size)
        throw Error("Choose a PDF smaller than 8 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const s = { name: file.name, base64: btoa(binary) };
      const r = await api<PdfReview>(
        `/projects/${projectId}/proposals/${proposal.id}/pdf-import/preview`,
        "POST",
        { ...s, revision: proposal.revision },
      );
      if (alive.current && sequence === attempt.current) {
        setSource(s);
        setReview(r);
      }
    } catch (e: any) {
      if (alive.current && sequence === attempt.current) setError(e.message);
    } finally {
      if (alive.current && sequence === attempt.current) setBusy(false);
    }
  }
  async function apply() {
    if (!review || !source) return;
    setError("");
    try {
      applyPdfImport(current, review, { sections, items }); // Validate everything before persisting the source.
      setApplying(true);
      await api(
        `/projects/${projectId}/proposals/${proposal.id}/pdf-import/attach`,
        "POST",
        { ...source, revision: proposal.revision },
      );
      if (alive.current) {
        onApply(review, { sections, items });
        onClose();
      }
    } catch (e: any) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setApplying(false);
    }
  }
  return (
    <Modal
      title="Import PDF"
      onClose={() => {
        if (!applying) onClose();
      }}
    >
      <div className="pdf-review">
        <p>
          Selectable-text PDFs only, up to 8 MB and 50 pages. Scanned PDFs and
          OCR are not supported. Extraction stays on this server.
        </p>
        <p>
          Nothing is selected automatically. Selected text is appended; existing
          content and prices stay intact. Apply does not save or share the
          proposal.
        </p>
        <label className="pdf-upload">
          Choose proposal PDF
          <input
            aria-label="Choose proposal PDF"
            type="file"
            accept="application/pdf,.pdf"
            disabled={busy || applying}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </label>
        {busy && <p role="status">Reading PDF locally…</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {review && (
          <>
            <div className="pdf-warnings">
              {review.warnings.slice(0, 20).map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
            <details>
              <summary>Customer and property reference only</summary>
              <pre>
                {review.reference ||
                  "No labeled customer/address reference found."}
              </pre>
            </details>
            {(Object.keys(sectionNames) as SectionKey[]).map((key) => (
              <section key={key} className="pdf-section">
                <label>
                  <input
                    type="checkbox"
                    checked={sections.includes(key)}
                    disabled={applying}
                    onChange={(e) =>
                      setSections((v) =>
                        e.target.checked
                          ? [...v, key]
                          : v.filter((k) => k !== key),
                      )
                    }
                  />
                  Apply {sectionNames[key]}
                </label>
                <label>
                  <span>Edit {sectionNames[key]}</span>
                  <textarea
                    aria-label={`Extracted ${sectionNames[key]}`}
                    maxLength={key === "schedule" ? 2000 : 20000}
                    value={review.sections[key]}
                    disabled={applying}
                    onChange={(e) =>
                      setReview({
                        ...review,
                        sections: { ...review.sections, [key]: e.target.value },
                      })
                    }
                  />
                </label>
              </section>
            ))}
            <h3>Materials and priced work</h3>
            <p>
              Only explicitly selected work is appended. Enter missing quantity
              and unit price manually. Payments, totals, balances, taxes and
              discounts cannot be imported as work items. Exact duplicate
              descriptions/prices are skipped; conflicting duplicates require
              correction in the existing proposal.
            </p>
            {review.items.map((row, i) => (
              <section className="pdf-section" key={i}>
                <label>
                  <input
                    type="checkbox"
                    aria-label={`Apply imported item ${i + 1}`}
                    checked={items.includes(i)}
                    disabled={applying}
                    onChange={(e) =>
                      setItems((v) =>
                        e.target.checked ? [...v, i] : v.filter((n) => n !== i),
                      )
                    }
                  />
                  Apply work item {i + 1}
                </label>
                {(["label", "quantity", "price"] as const).map((k) => (
                  <label key={k}>
                    <span>
                      {k === "label"
                        ? "Description"
                        : k === "quantity"
                          ? "Whole-number quantity"
                          : "Unit price ($)"}
                    </span>
                    <input
                      aria-label={`Imported ${k} ${i + 1}`}
                      value={row[k]}
                      disabled={applying}
                      maxLength={k === "label" ? 200 : 30}
                      inputMode={k === "label" ? "text" : "decimal"}
                      onChange={(e) =>
                        setReview({
                          ...review,
                          items: review.items.map((v, n) =>
                            n === i ? { ...v, [k]: e.target.value } : v,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
                {(!row.quantity || !row.price) && (
                  <p>
                    Uncertain item — enter and verify both quantity and unit
                    price before selecting.
                  </p>
                )}
              </section>
            ))}
            <button
              className="btn secondary"
              disabled={applying || review.items.length >= 100}
              onClick={() =>
                setReview({
                  ...review,
                  items: [
                    ...review.items,
                    { label: "", quantity: "", price: "" },
                  ],
                })
              }
            >
              Add reviewed work item
            </button>
            <details>
              <summary>
                Extracted source text — check against original PDF
              </summary>
              <pre>{review.raw}</pre>
            </details>
            <p>
              The original PDF will be attached privately to this project when
              you apply. Cancelling review does not attach it or change the
              proposal.
            </p>
          </>
        )}
        <div className="pdf-actions">
          <button
            className="btn secondary"
            disabled={applying}
            onClick={onClose}
          >
            Cancel import
          </button>
          <button
            className="btn primary"
            disabled={
              busy || applying || !review || (!sections.length && !items.length)
            }
            onClick={() => void apply()}
          >
            {applying ? "Applying…" : "Apply selected sections"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
