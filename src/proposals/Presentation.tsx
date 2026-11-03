import { useState } from "react";
import {
  Check,
  ArrowRight,
  ShieldCheck,
  ArrowDown,
  Download,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { calculateTotal, type ProposalData } from "../../shared/proposal";
import { money, type Agreement } from "../api";
import { Brand, Field } from "../ui";
export default function Presentation({
  proposal,
  project,
  company,
  agreement,
  accept,
  onPrint = true,
}: {
  proposal: ProposalData;
  project: { name: string; address: string };
  company: string;
  agreement?: Agreement | null;
  accept?: (data: {
    name: string;
    consent: boolean;
    selectedIds: string[];
  }) => Promise<void>;
  onPrint?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(
      agreement?.snapshot?.selectedIds || [],
    ),
    [name, setName] = useState(""),
    [consent, setConsent] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const total =
    agreement?.total ??
    calculateTotal(proposal.items, proposal.options, selected);
  return (
    <article className="proposal-presentation">
      <div className="presentation-header">
        <Brand />
        <span>
          {company}
          <small>A CONSIDERED APPROACH TO YOUR HOME</small>
        </span>
      </div>
      <div className="presentation-cover">
        {proposal.designImage ? <img src={proposal.designImage} alt="Selected project image" /> : <div className="neutral-project-cover" role="img" aria-label="No project photo selected" />}
        <div className="cover-gradient" />
        <div className="cover-content">
          <span className="eyebrow">A VISION, SHARED.</span>
          <h1>{project.name}</h1>
          <p>{project.address || "A place for your next chapter."}</p>
          <span className="cover-label">
            {proposal.designImage
              ? "YOUR PROJECT DESIGN"
              : "PROJECT PROPOSAL"}
          </span>
        </div>
      </div>
      <div className="presentation-body">
        <span className="eyebrow">01 / THE POSSIBILITIES</span>
        <h2>{proposal.title}</h2>
        <p className="presentation-intro">
          Good design is personal. This is our plan for bringing your vision to
          life, with every detail clearly considered.
        </p>
        <div className="scope-block">
          <h3>The scope of your project</h3>
          <p>{proposal.scope}</p>
        </div>
        <div className="presentation-rule" />
        <span className="eyebrow">02 / YOUR INVESTMENT</span>
        <h2>Clarity in every detail.</h2>
        <p className="muted">
          A transparent view of what’s included, and the possibilities you can
          add.
        </p>
        <div className="pricing-table">
          <div className="pricing-table-head">
            <span>PROJECT SCOPE</span>
            <span>QTY</span>
            <span>AMOUNT</span>
          </div>
          {proposal.items.map((item) => (
            <div className="pricing-row" key={item.id}>
              <strong>{item.label}</strong>
              <span>{item.quantity}</span>
              <span>{money(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
        {proposal.options.length > 0 && (
          <div className="optional-items">
            <span className="eyebrow">MAKE IT A LITTLE MORE YOURS</span>
            {proposal.options.map((o) => (
              <label
                key={o.id}
                className={
                  "upgrade-option " +
                  (selected.includes(o.id) ? "selected" : "")
                }
              >
                <input
                  type="checkbox"
                  aria-label={o.label}
                  disabled={!!agreement}
                  checked={selected.includes(o.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, o.id]
                        : selected.filter((id) => id !== o.id),
                    )
                  }
                />
                <div>
                  <strong>{o.label}</strong>
                  <small>
                    Optional addition · {o.quantity} × {money(o.price)}
                  </small>
                </div>
                <span>+ {money(o.price * o.quantity)}</span>
              </label>
            ))}
          </div>
        )}
        <div className="proposal-total">
          <div>
            <span>YOUR PROJECT INVESTMENT</span>
            <small>USD · No payment collected here</small>
          </div>
          <strong>{money(total)}</strong>
        </div>
        <div className="presentation-rule" />
        <div className="terms-grid">
          <div>
            <span className="eyebrow">03 / THE WAY FORWARD</span>
            <h3>A timeline with intention.</h3>
            <p>{proposal.schedule}</p>
          </div>
          <div>
            <span className="eyebrow">04 / THE DETAILS</span>
            <h3>On the same page.</h3>
            <p>{proposal.terms}</p>
          </div>
        </div>
        {agreement ? (
          <div className="signed-receipt">
            <CheckCircle2 size={34} />
            <span className="eyebrow">YOUR NEXT CHAPTER IS OFFICIAL</span>
            <h2>A great beginning.</h2>
            <p>
              Accepted by <strong>{agreement.name}</strong> on{" "}
              {new Date(agreement.acceptedAt).toLocaleDateString()}.
            </p>
            <p>
              Your agreed investment: <strong>{money(agreement.total)}</strong>
            </p>
            <small>Agreement verification SHA-256</small>
            <code>{agreement.sha256}</code>
            <p className="receipt-note">
              The accepted scope, pricing, and terms are preserved in your
              agreement.
            </p>
          </div>
        ) : accept ? (
          <form
            className="acceptance-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await accept({ name, consent, selectedIds: selected });
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <ShieldCheck size={27} />
            <span className="eyebrow">READY WHEN YOU ARE</span>
            <h2>Let’s make it happen.</h2>
            <p>
              Your acceptance records the scope, selected options, price, and
              terms shown above.
            </p>
            <Field
              label="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={1}
              maxLength={120}
              placeholder="As you’d like it on your agreement"
            />
            <label className="consent-check">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
              />
              <span>
                I have reviewed this proposal and agree to the selected scope,
                price, and terms.
              </span>
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="btn primary" disabled={busy}>
              {busy ? "Recording acceptance…" : "Accept proposal"}
              <ArrowRight size={17} />
            </button>
            <small className="acceptance-disclaimer">
              Typed acceptance creates an audit record. This preview does not
              provide certified signature services.
            </small>
          </form>
        ) : (
          <div className="preview-notice">
            <ShieldCheck size={18} />
            <p>
              Client preview · Your client can choose options and accept after
              you create a private link.
            </p>
          </div>
        )}
        {onPrint && (
          <button className="print-button" onClick={() => window.print()}>
            <Download size={16} />
            Print / save as PDF
          </button>
        )}
      </div>
      <footer className="presentation-footer">
        <span>Built on a shared vision.</span>
        <Brand />
      </footer>
    </article>
  );
}
