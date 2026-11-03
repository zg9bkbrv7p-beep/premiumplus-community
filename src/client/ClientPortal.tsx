import LiveProject from '../workspace/LiveProject';
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  MessageSquare,
  FileText,
  Lock,
  ArrowUpRight,
  Check,
} from "lucide-react";
import { api, setCsrf, date } from "../api";
import { Brand } from "../ui";
import Presentation from "../proposals/Presentation";
export default function ClientPortal() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [tab, setTab] = useState("proposal"),
    [comments, setComments] = useState<any[]>([]),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [commentError, setCommentError] = useState("");
  async function load() {
    const d = await api("/client/project");
    setData(d);
    setCsrf(d.csrf);
    setComments(await api("/client/comments"));
  }
  const initialization = useRef<Promise<{ data: any; comments: any[] }> | null>(
    null,
  );
  useEffect(() => {
    let alive = true;
    if (!initialization.current) {
      const token = new URLSearchParams(location.hash.slice(1)).get("share");
      if (token) history.replaceState(null, "", "/client");
      initialization.current = (async () => {
        if (token) await api("/client/exchange", "POST", { token });
        const [data, comments] = await Promise.all([
          api("/client/project"),
          api<any[]>("/client/comments"),
        ]);
        return { data, comments };
      })();
    }
    initialization.current
      .then((result) => {
        if (alive) {
          setData(result.data);
          setCsrf(result.data.csrf);
          setComments(result.comments);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  if (loading)
    return (
      <div className="loading-screen">
        <Brand />
        <div className="spinner" />
        <p>Opening your next chapter…</p>
      </div>
    );
  if (error)
    return (
      <div className="client-unavailable">
        <Brand />
        <Lock size={32} />
        <h1>This project is private.</h1>
        <p role="alert">{error}</p>
        <span>Ask your contractor for a current private link.</span>
      </div>
    );
  if (!data) return null;
  return (
    <div className="client-layout">
      <header className="client-top">
        <Brand />
        <span>
          <Lock size={13} />
          PRIVATE PROJECT SPACE
        </span>
      </header>
      <div className="client-welcome">
        <span className="eyebrow">
          PREPARED WITH CARE BY {data.company.toUpperCase()}
        </span>
        <h1>{data.project.name}</h1>
        <p>Your vision, our shared next chapter.</p>
      </div>
      <nav className="client-tabs">
        <button className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}>Live project</button>
        <button
          className={tab === "proposal" ? "active" : ""}
          onClick={() => setTab("proposal")}
        >
          <FileText size={17} />
          Your proposal
        </button>
        <button
          className={tab === "comments" ? "active" : ""}
          onClick={() => setTab("comments")}
        >
          <MessageSquare size={17} />
          Conversation
        </button>
      </nav>
      <main className="client-main">
        {tab === "live" ? (<LiveProject client />) : tab === "proposal" ? (
          <Presentation
            key={data.agreement?.id || data.proposal.id}
            proposal={data.proposal}
            project={data.project}
            company={data.company}
            agreement={data.agreement}
            accept={async (input) => {
              await api("/client/accept", "POST", input);
              await load();
            }}
          />
        ) : (
          <section className="client-conversation panel">
            <span className="eyebrow">
              GOOD PROJECTS START WITH A CONVERSATION
            </span>
            <h2>A little clarity goes a long way.</h2>
            <p>
              Questions, thoughts, or a new idea? Leave a note for your
              contractor. Comments do not change the agreed scope or price.
            </p>
            {comments.map((c) => (
              <div className="comment" key={c.id}>
                <strong>
                  {c.author}
                  <small>{date(c.created_at)}</small>
                </strong>
                <p>{c.body}</p>
              </div>
            ))}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setCommentError("");
                try {
                  await api("/client/comments", "POST", { body });
                  setBody("");
                  setComments(await api("/client/comments"));
                } catch (e: any) {
                  setCommentError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="field">
                <span>Your message</span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  maxLength={4000}
                  placeholder="What’s on your mind?"
                />
              </label>
              {commentError && <p className="error">{commentError}</p>}
              <button className="btn primary" disabled={busy}>
                Send your note <ArrowRight size={16} />
              </button>
            </form>
          </section>
        )}
      </main>
      <footer className="client-footer">
        One shared vision. A clearer way to build.<span>PREMIUM+ COMMUNITY · <a href="/source.html" target="_blank" rel="noopener noreferrer">Source code</a></span>
      </footer>
    </div>
  );
}
