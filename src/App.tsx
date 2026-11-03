import { chooseWelcomeImage } from "./welcome/images";
import Join from "./account/Join";
import Recovery from "./account/Recovery";
import Settings from "./account/Settings";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  LayoutGrid,
  FolderOpen,
  LogOut,
  Menu,
  Sparkles,
  FileText,
  Camera,
  ChevronRight,
  X,
} from "lucide-react";
import { api, type Project } from "./api";
import { Brand, Field } from "./ui";
import Workspace from "./workspace/Workspace";
import ProjectPage from "./workspace/ProjectPage";
import ClientPortal from "./client/ClientPortal";
export default function App() {
  const [welcome] = useState(chooseWelcomeImage);
  const [user, setUser] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState("overview"),
    [project, setProject] = useState<Project | null>(null),
    [mobile, setMobile] = useState(false),
    [authMode, setAuthMode] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const isClient =
    location.pathname === "/client" || location.hash.startsWith("#share=");
  useEffect(() => {
    if (isClient) {
      setLoading(false);
      return;
    }
    api("/auth/session")
      .then(async (d) => {
        setUser(d.user);
        const id = new URLSearchParams(location.search).get("project");
        if (id) {
          try {
            setProject(await api("/projects/" + encodeURIComponent(id)));
          } catch {
            history.replaceState(null, "", "/");
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!user || isClient) return;
    let alive = true;
    const pop = async () => {
      if (
        dirty &&
        !confirm("You have unsaved changes. Leave without saving?")
      ) {
        history.pushState(
          null,
          "",
          project ? "/?project=" + encodeURIComponent(project.id) : "/",
        );
        return;
      }
      setDirty(false);
      const q = new URLSearchParams(location.search);
      const id = q.get("project");
      if (!id) {
        setProject(null);
        return;
      }
      try {
        const p = await api<Project>("/projects/" + encodeURIComponent(id));
        if (alive) setProject(p);
      } catch {
        if (alive) {
          setProject(null);
          history.replaceState(null, "", "/");
        }
      }
    };
    window.addEventListener("popstate", pop);
    return () => {
      alive = false;
      window.removeEventListener("popstate", pop);
    };
  }, [user, dirty, project, isClient]);
  async function auth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const d = await api(
        "/auth/" + (authMode ? "register" : "login"),
        "POST",
        data,
      );
      setUser(d.user);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (location.hash.startsWith("#join")) return <Join />;
  if (/^#(reset|verify|recover)/.test(location.hash)) return <Recovery />;
  if (isClient) return <ClientPortal />;
  if (loading)
    return (
      <div className="loading-screen">
        <Brand />
        <div className="spinner" />
        <p>Making room for your next idea…</p>
      </div>
    );
  if (!user)
    return (
      <div className="auth-layout">
        <section className="auth-visual">
          <img src={welcome.src} srcSet={`${welcome.src} 1400w, ${welcome.highRes} 3840w`} sizes="(max-width: 800px) 100vw, 60vw" alt={welcome.alt} decoding="async" />
          <div className="auth-scrim" />
          <Brand dark />
          <div className="auth-statement">
            <span className="eyebrow">
              FROM THE FIRST LINE. TO THE FINAL YES.
            </span>
            <h1>
              Good spaces.
              <br />
              Great beginnings.
            </h1>
            <p>
              One thoughtful workspace for the places
              <br />
              you imagine and the people you build with.
            </p>
            <div className="auth-features">
              <span>
                <Check size={15} /> Preview your real property
              </span>
              <span>
                <Check size={15} /> Propose beautifully
              </span>
              <span>
                <Check size={15} /> Move forward together
              </span>
            </div>
          </div>
          <span className="auth-bottom">A CLEARER WAY TO BUILD. · <a href="/source.html" target="_blank" rel="noopener noreferrer">Open-source code</a></span>
        </section>
        <main className="auth-form-wrap">
          <div className="auth-mobile">
            <Brand />
          </div>
          <div className="auth-form">
            <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
            <h2>
              {authMode ? "A space of your own." : "Welcome to your vision."}
            </h2>
            <p>
              {authMode
                ? "Create your studio’s workspace. Make your next idea real."
                : "Turn your ideas into spaces. And your proposals into possibilities."}
            </p>
            <div className="segmented">
              <button
                className={!authMode ? "active" : ""}
                onClick={() => {
                  setAuthMode(false);
                  setError("");
                }}
              >
                Sign in
              </button>
              <button
                className={authMode ? "active" : ""}
                onClick={() => {
                  setAuthMode(true);
                  setError("");
                }}
              >
                Create workspace
              </button>
            </div>
            <form onSubmit={auth}>
              {authMode && (
                <>
                  <Field
                    label="Your name"
                    name="name"
                    required
                    autoComplete="name"
                  />
                  <Field
                    label="Studio / company"
                    name="company"
                    required
                    autoComplete="organization"
                  />
                </>
              )}
              <Field
                label="Email address"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@yourstudio.com"
              />
              <Field
                label="Password"
                type="password"
                name="password"
                minLength={authMode ? 12 : 1}
                maxLength={128}
                required
                autoComplete={authMode ? "new-password" : "current-password"}
                placeholder={
                  authMode ? "At least 12 characters" : "Your password"
                }
              />
              {error && (
                <div role="alert" className="error">
                  {error}
                </div>
              )}
              <button className="btn primary full" disabled={busy}>
                {busy
                  ? "One moment…"
                  : authMode
                    ? "Create my workspace"
                    : "Enter your workspace"}
                <ArrowRight size={18} />
              </button>
              <a
                href="/#recover"
                onClick={(e) => {
                  e.preventDefault();
                  location.hash = "recover";
                  location.reload();
                }}
              >
                Forgot password?
              </a>
            </form>
            <p className="auth-footnote">
              Private by design. Created for your next great project.
            </p>
            <div className="local-note">
              <span className="status-dot" /> NEW INDEPENDENT EDITION · LOCAL
              REVIEW
            </div>
          </div>
        </main>
      </div>
    );
  function openProject(p: Project, tab = "overview") {
    setPage("projects");
    setProject(p);
    history.pushState(null, "", "/?project=" + encodeURIComponent(p.id) + "&tab=" + tab);
  }
  function closeProject() {
    if (
      dirty &&
      !window.confirm("You have unsaved changes. Leave without saving?")
    )
      return false;
    setDirty(false);
    setProject(null);
    history.pushState(null, "", "/");
    return true;
  }
  const nav = [
    ["overview", LayoutGrid, "Dashboard"],
    ["projects", FolderOpen, "Projects"],
    ["proposals", FileText, "Proposals"],
  ] as const;
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {mobile && (
        <button
          aria-label="Close navigation"
          className="sidebar-shade"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <Brand />
        <div className="workspace-chip">
          <span className="studio-avatar">{user.company?.[0] || "S"}</span>
          <div>
            <strong>{user.company}</strong>
            <small>YOUR WORKSPACE</small>
          </div>
        </div>
        <span className="nav-caption">WORKSPACE</span>
        <nav>
          {[...nav, ["settings", FileText, "Company & account"] as const].map(
            ([key, Icon, label]) => (
              <button
                key={key}
                className={page === key ? "active" : ""}
                onClick={() => {
                  if (closeProject()) {
                    setPage(key);
                    setMobile(false);
                  }
                }}
              >
                <Icon size={19} />
                {label}
                {page === key && <span className="nav-active-dot" />}
              </button>
            ),
          )}
        </nav>
        <div className="sidebar-bottom">
          <span className="local-note">
            <span className="status-dot" /> PRIVATE WORKSPACE
          </span>
          <div className="user-block">
            <span className="user-avatar">
              {user.name
                .split(" ")
                .map((n: string) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>Studio owner</small>
            </div>
            <button
              className="icon-btn"
              aria-label="Sign out"
              onClick={async () => {
                await api("/auth/logout", "POST", {});
                setUser(null);
                setProject(null);
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-btn menu-btn"
              aria-label="Open navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {project ? project.name : nav.find((n) => n[0] === page)?.[2]}
            </strong>
          </div>
          <div className="topbar-end">
            <span className="today">
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="topbar-divider" />
            <span className="small-avatar">{user.name[0]}</span>
          </div>
        </header>
        <main
          id="main"
          className={project ? "project-main" : "workspace-main"}
        >
          {project ? (
            <ProjectPage
              key={project.id}
              project={project}
              initialTab={
                new URLSearchParams(location.search).get("tab") ||
                "overview"
              }
              onBack={closeProject}
              onProject={setProject}
              dirty={dirty}
              onDirty={setDirty}
            />
          ) : page === "settings" ? (
            <Settings user={user} />
          ) : (
            <Workspace
              user={user}
              page={page}
              onOpen={openProject}
            />
          )}
        </main>
        <footer className="app-footer">
          <span>Thoughtfully built. Beautifully connected.</span>
          <span>
            PREMIUM+ <span className="footer-dot">·</span> COMMUNITY
            EDITION <span className="footer-dot">·</span> <a href="/source.html" target="_blank" rel="noopener noreferrer">Source code</a>
          </span>
        </footer>
      </div>
    </div>
  );
}
