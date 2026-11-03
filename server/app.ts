import {mountPdfImport} from './pdf/routes';
import { mountOperations } from './operations';
import {mountRemodel} from './remodel/routes';
import type {RemodelProvider} from './remodel/provider';
import {mountCommercial,actorRole,projectAccess,assertProjectOpen,lifecycle,liveSummary,lockContract,contractDates} from './commercial';
import {mountEstimating} from './estimating';
import {mountIdentity,notifyRegistration,accountIdentity} from './identity';
import type {AppContext} from './context';
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { openDb } from "./db";
import { hash, token, passwordHash, passwordMatches } from "./auth";
import { defaultPlan, validatePlan } from "../shared/geometry";
import { validateProposal, calculateTotal } from "../shared/proposal";
import {proposalReadiness} from '../shared/proposalReadiness';
const text = (max = 200) => z.string().trim().min(1).max(max);
const uuid = () => randomUUID();
const now = () => new Date().toISOString();
function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}
export function createApp(
  path: string,
  publicUrl = process.env.PUBLIC_URL || "http://localhost",
  options: {remodelProvider?:RemodelProvider} = {},
) {
  const db = openDb(path),
    app = express(),
    secure = process.env.NODE_ENV === "production";
  if (secure && !publicUrl.startsWith("https://"))
    throw Error("Production requires an HTTPS PUBLIC_URL");
  const origin = new URL(publicUrl).origin;
  // E2E-only fixture allowance: never active in production or on a public origin.
  const browserFixtureMode = process.env.NODE_ENV === "test" &&
    process.env.PREMIUM_E2E_MODE === "1" &&
    /^http:\/\/localhost(?::\d+)?$/.test(origin);
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    next();
  });
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "15mb" }));
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") !== origin
    )
      return res.status(403).json({ error: "Request origin is not permitted" });
    next();
  });
  const one = (sql: string, ...values: any[]) =>
    db.prepare(sql).get(...values) as any;
  const all = (sql: string, ...values: any[]) =>
    db.prepare(sql).all(...values) as any[];
  const run = (sql: string, ...values: any[]) => db.prepare(sql).run(...values);
  const event = (id: string, label: string) =>
    run("INSERT INTO events VALUES(?,?,?,?)", uuid(), id, label, now());
  function limited(key: string, max: number) {
    let r = one("SELECT * FROM attempts WHERE key=?", key);
    if (!r || r.until < Date.now()) {
      run(
        "INSERT OR REPLACE INTO attempts VALUES(?,?,?)",
        key,
        1,
        Date.now() + 15 * 60 * 1000,
      );
      return;
    }
    if (r.count >= max)
      fail(429, "Too many attempts. Try again in 15 minutes.");
    run("UPDATE attempts SET count=count+1 WHERE key=?", key);
  }
  function cookie(req: Request) {
    return (
      req.headers.cookie
        ?.split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("vision_session="))
        ?.slice(15) || ""
    );
  }
  function session(req: Request) {
    return one(
      "SELECT * FROM sessions WHERE hash=? AND expires>?",
      hash(cookie(req)),
      Date.now(),
    );
  }
  function setSession(
    res: Response,
    userId: string | null,
    shareId: string | null,
  ) {
    const raw = token(),
      csrf = token();
    run(
      "INSERT INTO sessions VALUES(?,?,?,?,?)",
      hash(raw),
      userId,
      shareId,
      csrf,
      Date.now() + 7 * 86400000,
    );
    res.cookie("vision_session", raw, {
      httpOnly: true,
      sameSite: "strict",
      secure,
      path: "/",
      maxAge: 7 * 86400000,
    });
    return csrf;
  }
  function csrf(req: Request, s: any) {
    if (!s || req.get("x-csrf-token") !== s.csrf)
      fail(403, "Session verification failed. Refresh and try again.");
  }
  function owner(req: Request, write = false) {
    const s = session(req);
    if (!s?.user_id||s.share_id) fail(401, "Sign in to continue");
    const role=actorRole(ctx,s.user_id);
    if(!role)fail(401,"Account access is no longer active");
    const account=one("SELECT company_id FROM users WHERE id=?",s.user_id);
    if (write){csrf(req, s);if(process.env.REQUIRE_VERIFIED_EMAIL==="1"&&!accountIdentity(ctx,s.user_id).emailVerified)fail(403,"Verify your email before changing company projects");}
    return {role,
      ...one(
        "SELECT id,company_id,name,email FROM users WHERE id=?",
        s.user_id,
      ),
      csrf: s.csrf,
    };
  }
  function project(req: Request, write = false) {
    const u = owner(req, write),
      p = one(
        "SELECT * FROM projects WHERE id=? AND company_id=?",
        req.params.id,
        u.company_id,
      );
    if (!p || one("SELECT deleted_at FROM project_trash WHERE project_id=? AND deleted_at IS NOT NULL",p.id)) fail(404, "Project not found");
    projectAccess(ctx,u,p.id,write);if(write)assertProjectOpen(ctx,p.id);
    return { u, p };
  }
  const projectDto = (p: any, privatePhotos = true) => ({
    id: p.id,
    companyId: p.company_id,
    name: p.name,
    address: p.address,
    description: p.description,
    revision: p.revision,
    plan: JSON.parse(p.plan),
    image: p.image,
    previewPhoto: !privatePhotos || !!one("SELECT 1 FROM project_trash WHERE project_id=? AND deleted_at IS NOT NULL",p.id) ? null : (()=>{const photo=one("SELECT id,name FROM remodel_photos WHERE project_id=? ORDER BY created_at DESC LIMIT 1",p.id);return photo?{id:photo.id,name:photo.name,imageUrl:`/api/projects/${p.id}/remodel/photos/${photo.id}`}:null;})(),
    ...(privatePhotos ? {
      archivedAt: one("SELECT archived_at FROM project_archives WHERE project_id=?",p.id)?.archived_at || null,
      deletedAt: one("SELECT deleted_at FROM project_trash WHERE project_id=?",p.id)?.deleted_at || null,
      pendingHomeownerDecisions: one("SELECT COUNT(*) n FROM live_decisions WHERE project_id=? AND status='pending'",p.id).n,
      photoCount: one("SELECT (SELECT COUNT(*) FROM remodel_photos WHERE project_id=?)+(SELECT COUNT(*) FROM project_files WHERE project_id=? AND mime LIKE 'image/%') n",p.id,p.id).n,
      draftProposalCount: one("SELECT COUNT(*) n FROM proposals WHERE project_id=? AND status='draft'",p.id).n,
      latestProposalStatus: one("SELECT status FROM proposals WHERE project_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1",p.id)?.status || null,
    } : {}),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    ...liveSummary(ctx,p.id),
  });
  const proposalDto = (p: any) =>
    p
      ? {
          id: p.id,
          projectId: p.project_id,
          revision: p.revision,
          status: p.status,
          ...JSON.parse(p.data),
        }
      : null;
  const agreementDto = (a: any) =>
    a
      ? {
          id: a.id,
          name: a.name,
          acceptedAt: a.accepted_at,
          sha256: a.sha256,
          total: a.total,
          snapshot: JSON.parse(a.snapshot),
        }
      : null;
  function transaction<T>(fn: () => T) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const v = fn();
      db.exec("COMMIT");
      return v;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.post("/api/auth/register", (req, res) => {
    limited("register:" + req.ip, browserFixtureMode ? 200 : 15);
    const b = z
      .object({
        name: text(100),
        company: text(120),
        email: z.email().max(254),
        password: z.string().min(12).max(128),
      })
      .parse(req.body);
    const email = b.email.toLowerCase();
    if (one("SELECT id FROM users WHERE email=?", email))
      fail(409, "An account already exists for this email");
    const uid = uuid(),
      cid = uuid();
    transaction(() => {
      run("INSERT INTO companies VALUES(?,?)", cid, b.company);
      run(
        "INSERT INTO users VALUES(?,?,?,?,?)",
        uid,
        cid,
        b.name,
        email,
        passwordHash(b.password),
      );
      run("INSERT INTO memberships VALUES(?,?,?,?)",uid,cid,"owner",1);
    });
    void notifyRegistration(ctx,uid);
    const c = setSession(res, uid, null);
    res.status(201).json({
      user: { id: uid, name: b.name, email, company: b.company,role:"owner",...accountIdentity(ctx,uid) },
      csrf: c,
    });
  });
  app.post("/api/auth/login", (req, res) => {
    limited("login-ip:" + req.ip, 50);
    const b = z
      .object({ email: z.email().max(254), password: z.string().max(128) })
      .parse(req.body);
    limited("login:" + b.email.toLowerCase(), 12);
    const u = one("SELECT * FROM users WHERE email=?", b.email.toLowerCase());
    const valid = passwordMatches(
      b.password,
      u?.password || passwordHash("dummy-password"),
    );
    if (!u || !valid) fail(401, "Email or password is incorrect");
    const c = setSession(res, u.id, null);
    res.json({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        role:actorRole(ctx,u.id),...accountIdentity(ctx,u.id),
        company: one("SELECT name FROM companies WHERE id=?", u.company_id)
          .name,
      },
      csrf: c,
    });
  });
  app.get("/api/auth/session", (req, res) => {
    const u = owner(req);
    res.json({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        role:actorRole(ctx,u.id),...accountIdentity(ctx,u.id),
        company: one("SELECT name FROM companies WHERE id=?", u.company_id)
          .name,
      },
      csrf: u.csrf,
    });
  });
  app.post("/api/auth/logout", (req, res) => {
    const s = session(req);
    csrf(req, s);
    run("DELETE FROM sessions WHERE hash=?", hash(cookie(req)));
    res.clearCookie("vision_session", { path: "/" });
    res.json({ ok: true });
  });
  app.get("/api/projects", (req, res) => {
    const u = owner(req);
    res.json(
      all(
        "SELECT * FROM projects WHERE company_id=? AND (?='owner' OR id IN (SELECT project_id FROM project_members WHERE user_id=?)) AND NOT EXISTS(SELECT 1 FROM project_trash WHERE project_id=projects.id AND deleted_at IS NOT NULL) AND (?=1 OR NOT EXISTS(SELECT 1 FROM project_archives WHERE project_id=projects.id AND archived_at IS NOT NULL)) ORDER BY updated_at DESC",
        u.company_id,u.role,u.id,req.query.includeArchived==="1"?1:0,
      ).map((p) => ({
        ...projectDto(p),
        proposalCount: one(
          "SELECT COUNT(*) n FROM proposals WHERE project_id=?",
          p.id,
        ).n,
        accepted: !!one(
          "SELECT id FROM agreements WHERE proposal_id IN (SELECT id FROM proposals WHERE project_id=?)",
          p.id,
        ),
      })),
    );
  });
  app.post("/api/projects", (req, res) => {
    const u = owner(req, true);
    if(u.role!=="owner")fail(403,"Only company owners can create projects");
    const b = z
      .object({
        name: text(),
        address: z.string().max(400).default(""),
        description: z.string().max(5000).default(""),
      })
      .parse(req.body);
    const id = uuid();
    run(
      "INSERT INTO projects(id,company_id,name,address,description,revision,plan,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
      id,
      u.company_id,
      b.name,
      b.address,
      b.description,
      1,
      JSON.stringify(defaultPlan()),
      now(),
      now(),
    );
    event(id, "Project created");
    res
      .status(201)
      .json(projectDto(one("SELECT * FROM projects WHERE id=?", id)));
  });
  // Recoverable Trash for unsigned drafts. Do not destroy append-only history.
  app.get('/api/projects/trash',(req,res)=>{
    const u=owner(req);
    if(u.role!=='owner')fail(403,'Only company owners can manage Trash');
    const rows=all('SELECT p.* FROM projects p JOIN project_trash t ON t.project_id=p.id WHERE p.company_id=? AND t.deleted_at IS NOT NULL ORDER BY t.deleted_at DESC',u.company_id);
    res.json(rows.map(p=>({...projectDto(p),proposalCount:one('SELECT COUNT(*) n FROM proposals WHERE project_id=?',p.id).n})));
  });
  app.post('/api/projects/:id/trash',(req,res)=>{
    const u=owner(req,true);
    if(u.role!=='owner')fail(403,'Only the company owner can move a project to Trash');
    const p=one('SELECT * FROM projects WHERE id=? AND company_id=?',req.params.id,u.company_id);
    if(!p)fail(404,'Project not found');
    const body=z.object({confirmName:z.string()}).strict().parse(req.body);
    if(body.confirmName!==p.name)fail(422,'Type the exact project name to confirm moving it to Trash');
    if(one('SELECT deleted_at FROM project_trash WHERE project_id=? AND deleted_at IS NOT NULL',p.id))fail(409,'Project is already in Trash');
    if(one('SELECT a.id FROM agreements a JOIN proposals pr ON pr.id=a.proposal_id WHERE pr.project_id=?',p.id))fail(409,'Accepted contracts must be preserved. Archive this project instead.');
    transaction(()=>{
      run('UPDATE shares SET revoked=1 WHERE project_id=?',p.id);
      run('UPDATE project_archives SET archived_at=NULL WHERE project_id=?',p.id);
      run('INSERT INTO project_trash(project_id,deleted_at,deleted_by) VALUES(?,?,?) ON CONFLICT(project_id) DO UPDATE SET deleted_at=excluded.deleted_at,deleted_by=excluded.deleted_by',p.id,now(),u.id);
      event(p.id,'Draft project moved to Trash by company owner');
    });
    res.json({ok:true,inTrash:true,permanent:false});
  });
  app.post('/api/projects/:id/restore-trash',(req,res)=>{
    const u=owner(req,true);
    if(u.role!=='owner')fail(403,'Only the company owner can restore a project');
    const p=one('SELECT * FROM projects WHERE id=? AND company_id=?',req.params.id,u.company_id);
    if(!p)fail(404,'Project not found');
    if(!one('SELECT deleted_at FROM project_trash WHERE project_id=? AND deleted_at IS NOT NULL',p.id))fail(409,'Project is not in Trash');
    transaction(()=>{
      run('UPDATE project_trash SET deleted_at=NULL WHERE project_id=?',p.id);
      event(p.id,'Draft project restored from Trash by company owner');
    });
    res.json(projectDto(p));
  });
  app.get("/api/projects/:id", (req, res) => {
    const { p,u } = project(req);
    res.json({
      ...projectDto(p),
      canArchive: u.role==="owner",
      proposals: all(
        "SELECT * FROM proposals WHERE project_id=? ORDER BY created_at DESC",
        p.id,
      ).map(proposalDto),
      shares: all(
        "SELECT id,proposal_id,expires,revoked,created_at FROM shares WHERE project_id=? ORDER BY created_at DESC",
        p.id,
      ),
      agreements: all(
        "SELECT * FROM agreements WHERE proposal_id IN (SELECT id FROM proposals WHERE project_id=?)",
        p.id,
      ).map(agreementDto),
      comments: all(
        "SELECT * FROM comments WHERE project_id=? ORDER BY created_at",
        p.id,
      ),
      events: all(
        "SELECT * FROM events WHERE project_id=? ORDER BY created_at DESC LIMIT 100",
        p.id,
      ),
    });
  });
  app.patch("/api/projects/:id/archive", (req,res)=>{
    const u=owner(req,true);
    if(u.role!=="owner")fail(403,"Only company owners can archive or restore projects");
    const p=one("SELECT * FROM projects WHERE id=? AND company_id=?",req.params.id,u.company_id);
    if(!p)fail(404,"Project not found");
    if(one('SELECT deleted_at FROM project_trash WHERE project_id=? AND deleted_at IS NOT NULL',p.id))fail(409,'Restore this project from Trash first');
    const b=z.object({archived:z.boolean(),expectedArchived:z.boolean()}).strict().parse(req.body);
    transaction(()=>{
      const archived=!!one("SELECT archived_at FROM project_archives WHERE project_id=?",p.id)?.archived_at;
      if(archived!==b.expectedArchived)fail(409,"This project's archive status changed. Refresh before trying again.");
      if(archived===b.archived)return;
      run("INSERT INTO project_archives(project_id,archived_at,archived_by) VALUES(?,?,?) ON CONFLICT(project_id) DO UPDATE SET archived_at=excluded.archived_at,archived_by=excluded.archived_by",p.id,b.archived?now():null,u.id);
      event(p.id,b.archived?"Project archived":"Project restored from archive");
    });
    res.json({...projectDto(p),canArchive:true});
  });
  app.patch("/api/projects/:id", (req, res) => {
    const { p } = project(req, true);
    const b = z
      .object({
        revision: z.number().int(),
        name: text().optional(),
        address: z.string().max(400).optional(),
        description: z.string().max(5000).optional(),
        plan: z.unknown().optional(),
        image: z
          .string()
          .max(2200000)
          .refine(
            (v) =>
              v === "" || /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v),
          )
          .optional(),
      })
      .parse(req.body);
    if (b.revision !== p.revision)
      fail(
        409,
        "This project changed in another tab. Your edits are retained; reload the saved version before retrying.",
      );
    const plan =
      b.plan === undefined ? JSON.parse(p.plan) : validatePlan(b.plan);
    run(
      "UPDATE projects SET name=?,address=?,description=?,plan=?,image=?,revision=revision+1,updated_at=? WHERE id=?",
      b.name ?? p.name,
      b.address ?? p.address,
      b.description ?? p.description,
      JSON.stringify(plan),
      b.image ?? p.image,
      now(),
      p.id,
    );
    res.json(projectDto(one("SELECT * FROM projects WHERE id=?", p.id)));
  });
  app.post("/api/projects/:id/proposals", (req, res) => {
    const { p } = project(req, true);
    const data = validateProposal(req.body),
      id = uuid();
    run(
      "INSERT INTO proposals VALUES(?,?,?,?,?,?)",
      id,
      p.id,
      1,
      "draft",
      JSON.stringify(data),
      now(),
    );
    event(p.id, "New proposal draft");
    res
      .status(201)
      .json(proposalDto(one("SELECT * FROM proposals WHERE id=?", id)));
  });
  app.patch("/api/projects/:id/proposals/:pid", (req, res) => {
    const { p } = project(req, true);
    const prop = one(
      "SELECT * FROM proposals WHERE id=? AND project_id=?",
      req.params.pid,
      p.id,
    );
    if (!prop) fail(404, "Proposal not found");
    if (prop.status !== "draft")
      fail(
        409,
        "Shared and accepted proposals are locked. Create a new revision.",
      );
    if (req.body.revision !== prop.revision)
      fail(409, "Proposal changed. Reload before saving.");
    const data = validateProposal(req.body);
    run(
      "UPDATE proposals SET data=?,revision=revision+1 WHERE id=?",
      JSON.stringify(data),
      prop.id,
    );
    res.json(proposalDto(one("SELECT * FROM proposals WHERE id=?", prop.id)));
  });
  app.post("/api/projects/:id/proposals/:pid/revise", (req, res) => {
    const { p } = project(req, true);
    const old = one(
      "SELECT * FROM proposals WHERE id=? AND project_id=?",
      req.params.pid,
      p.id,
    );
    if (!old) fail(404, "Proposal not found");
    const id = uuid();
    run(
      "INSERT INTO proposals VALUES(?,?,?,?,?,?)",
      id,
      p.id,
      1,
      "draft",
      old.data,
      now(),
    );
    event(p.id, "Proposal revision created");
    res
      .status(201)
      .json(proposalDto(one("SELECT * FROM proposals WHERE id=?", id)));
  });
  app.post("/api/projects/:id/shares", (req, res) => {
    const { p } = project(req, true);
    const prop = one(
      "SELECT * FROM proposals WHERE id=? AND project_id=?",
      text().parse(req.body.proposalId),
      p.id,
    );
    if (!prop) fail(404, "Proposal not found");
    if(lifecycle(ctx,p.id).agreement_id)fail(409,"Contract v1 is locked. Use a change order for scope changes.");
    if (prop.status === "accepted")
      fail(409, "Create a new revision to share another proposal");
    const missing=proposalReadiness(validateProposal(JSON.parse(prop.data)),p.address);
    if(missing.length)fail(422,'Before sharing: '+missing.map(i=>i.message).join(' '));
    const id = uuid(),
      raw = token(),
      expires = Date.now() + 7 * 86400000;
    transaction(() => {
      run(
        "INSERT INTO shares VALUES(?,?,?,?,?,?,?)",
        id,
        p.id,
        prop.id,
        hash(raw),
        expires,
        0,
        now(),
      );
      run("UPDATE proposals SET status=? WHERE id=?", "shared", prop.id);
    });
    event(p.id, "Client link created");
    res.status(201).json({ id, token: raw, expires });
  });
  app.delete("/api/projects/:id/shares/:sid", (req, res) => {
    const { p } = project(req, true);
    const r = run(
      "UPDATE shares SET revoked=1 WHERE id=? AND project_id=?",
      req.params.sid,
      p.id,
    );
    if (!r.changes) fail(404, "Share not found");
    event(p.id, "Client link revoked");
    res.json({ ok: true });
  });
  app.post("/api/client/exchange", (req, res) => {
    limited("exchange:" + req.ip, 60);
    const raw = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(req.body.token);
    const share = one(
      "SELECT * FROM shares WHERE hash=? AND revoked=0 AND expires>?",
      hash(raw),
      Date.now(),
    );
    if (!share) fail(401, "This link is expired or has been revoked");
    if(one("SELECT deleted_at FROM project_trash WHERE project_id=? AND deleted_at IS NOT NULL",share.project_id))fail(404,"Project is unavailable");
    const c = setSession(res, null, share.id);
    event(share.project_id, "Client opened the shared project");
    res.json({ csrf: c });
  });
  function client(req: Request, write = false) {
    const s = session(req);
    if (!s?.share_id) fail(401, "Open your private project link to continue");
    const share = one(
      "SELECT * FROM shares WHERE id=? AND revoked=0 AND expires>?",
      s.share_id,
      Date.now(),
    );
    if (!share) fail(401, "This link is expired or has been revoked");
    if(one("SELECT deleted_at FROM project_trash WHERE project_id=? AND deleted_at IS NOT NULL",share.project_id))fail(404,"Project is unavailable");
    if (write) csrf(req, s);
    return {
      s,
      share,
      p: one("SELECT * FROM projects WHERE id=?", share.project_id),
      prop: one("SELECT * FROM proposals WHERE id=?", share.proposal_id),
    };
  }
  app.get("/api/client/project", (req, res) => {
    const { s, share, p, prop } = client(req);
    res.json({
      csrf: s.csrf,
      project: projectDto(p, false),
      proposal: proposalDto(prop),
      agreement: agreementDto(
        one("SELECT * FROM agreements WHERE proposal_id=?", prop.id),
      ),
      company: one("SELECT name FROM companies WHERE id=?", p.company_id).name,
      expires: share.expires,
    });
  });
  app.get("/api/client/comments", (req, res) => {
    const { p } = client(req);
    res.json(
      all(
        "SELECT * FROM comments WHERE project_id=? ORDER BY created_at",
        p.id,
      ),
    );
  });
  app.post("/api/client/comments", (req, res) => {
    const { p, share } = client(req, true);
    limited("comment:" + share.id, 40);
    const b = text(4000).parse(req.body.body),
      id = uuid();
    run(
      "INSERT INTO comments VALUES(?,?,?,?,?)",
      id,
      p.id,
      "Homeowner",
      b,
      now(),
    );
    res.status(201).json({ id });
  });
  app.post("/api/projects/:id/comments", (req, res) => {
    const { p, u } = project(req, true);
    const body = text(4000).parse(req.body.body),
      id = uuid();
    run(
      "INSERT INTO comments VALUES(?,?,?,?,?)",
      id,
      p.id,
      u.name,
      body,
      now(),
    );
    res.status(201).json({ id });
  });
  app.post("/api/client/accept", (req, res) => {
    const { prop, p } = client(req, true);
    const b = z
      .object({
        name: text(120),
        consent: z.literal(true),
        selectedIds: z.array(z.string()).max(30),
      })
      .parse(req.body);
    const existing = one(
      "SELECT * FROM agreements WHERE proposal_id=?",
      prop.id,
    );
    if (existing) return res.json(agreementDto(existing));
    if (prop.status !== "shared") fail(409, "This proposal cannot be accepted");
    assertProjectOpen(ctx,p.id);
    if(lifecycle(ctx,p.id).agreement_id)fail(409,"Contract v1 is locked. Use an authorized change order");
    const data = validateProposal(JSON.parse(prop.data)),
      total = calculateTotal(data.items, data.options, b.selectedIds),
      id = uuid(),
      acceptedAt = now();
    const snapshot = JSON.stringify({
      proposalId: prop.id,
      revision: prop.revision,
      proposal: data,
      project: { id: p.id, name: p.name, address: p.address },
      schedule:contractDates(ctx,p.id),
      company:one("SELECT name FROM companies WHERE id=?",p.company_id).name,
      name: b.name,
      consent: true,
      selectedIds: b.selectedIds,
      total,
      acceptedAt,
    });
    transaction(() => {
      run(
        "INSERT INTO agreements VALUES(?,?,?,?,?,?,?)",
        id,
        prop.id,
        b.name,
        acceptedAt,
        snapshot,
        hash(snapshot),
        total,
      );
      lockContract(ctx,p.id,id);
      run("UPDATE proposals SET status=? WHERE id=?", "accepted", prop.id);
      event(p.id, "Proposal accepted by " + b.name);
    });
    res
      .status(201)
      .json(agreementDto(one("SELECT * FROM agreements WHERE id=?", id)));
  });
  const ctx:AppContext={db,one,all,run,event,transaction,owner,project,client,limited,fail,session,csrf,setSession,projectDto,proposalDto,agreementDto,origin};
  mountCommercial(app,ctx);
  mountOperations(app,ctx);
  mountEstimating(app,ctx);
  mountIdentity(app,ctx);
  mountRemodel(app,ctx,options.remodelProvider);
  mountPdfImport(app,ctx);
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Endpoint not found" }),
  );
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      err instanceof z.ZodError
        ? 422
        : err.status ||
          (err.message?.includes("Opening") ||
          err.message?.includes("Walls") ||
          err.message?.includes("option") ||
          err.message?.includes("unique")
            ? 422
            : 500);
    const message =
      err instanceof z.ZodError
        ? err.issues[0]?.message
        : status === 500
          ? "Unable to complete this request"
          : err.message;
    if (status === 500) console.error(err);
    res.status(status).json({ error: message || "Invalid input" });
  });
  return { http: app, db };
}
