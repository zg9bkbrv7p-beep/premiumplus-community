import { useEffect, useRef, useState } from "react";
import { api, type Project, type Proposal } from "../api";
import {
  regionSchema,
  materials,
  type Mark,
  type RailingMaterial,
} from "../../shared/remodel";
import { uploadablePhoto } from "./photos";
import {Camera,Upload,ArrowLeft,ArrowRight,Check,LockKeyhole,WandSparkles,Download,Ruler,RotateCcw,ImagePlus,ChevronRight} from "lucide-react";
import "./remodel.css";
type Photo = {
  id: string;
  name: string;
  width: number;
  height: number;
  imageUrl: string;
  region: Mark[];
  material: RailingMaterial;
  brief?: string;
};
type Concept = {
  id: string;
  photoId: string;
  material: RailingMaterial;
  region: Mark[];
  status: string;
  error: string;
  imageUrl: string | null;
  createdAt: string;
  provider: string;
  brief?: string;
  colorStudy?: boolean;
  colorName?: string;
};
type Library = {
  photos: Photo[];
  concepts: Concept[];
  provider: { available: boolean; remainingAttempts: number; notice: string; name?: string };
};
export default function PhotoRemodel({
  project,
  onDirty,
  onProposal,
  onAdvanced,
}: {
  project: Project;
  onAdvanced: () => void;
  onDirty: (v: boolean) => void;
  onProposal: (proposalId: string) => Promise<void> | void;
}) {
  const [data, setData] = useState<Library | null>(null),
    [photoId, setPhotoId] = useState(""),
    [conceptId, setConceptId] = useState(""),
    [points, setPoints] = useState<Mark[]>([]),
    [material, setMaterial] = useState<RailingMaterial>("wood"),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    [marking, setMarking] = useState(false),
    [comparison, setComparison] = useState(50),
    [proposalId, setProposalId] = useState(""),
    [proposals, setProposals] = useState<Proposal[]>([]),
    [brief,setBrief] = useState(""),
    [finishColor,setFinishColor] = useState("ivory"),
    [step,setStep] = useState<"photo"|"area"|"changes"|"preview">("photo");
  const selectionKey = useRef(crypto.randomUUID()),
    mounted = useRef(true),
    selectionEdit = useRef(0);
  const base = `/projects/${project.id}/remodel`;
  async function load() {
    const d = await api<Library>(base);
    if (mounted.current) setData(d);
    return d;
  }
  useEffect(() => {
    mounted.current = true;
    load().catch((e) => setError(e.message));
    api<Project>(`/projects/${project.id}`)
      .then((p) => {
        if (mounted.current) setProposals(p.proposals || []);
      })
      .catch((e) => setError(e.message));
    return () => {
      mounted.current = false;
    };
  }, [project.id]);
  useEffect(() => {
    onDirty(dirty);
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, onDirty]);
  const pending = data?.concepts.some((c) =>
    ["queued", "running"].includes(c.status),
  );
  useEffect(() => {
    if (!pending) return;
    let stopped = false;
    const timer = setInterval(() => {
      if (!stopped)
        load().catch((e) => {
          if (!stopped) setError(e.message);
        });
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [pending, project.id]);
  const photo = data?.photos.find((p) => p.id === photoId),
    concept = data?.concepts.find((c) => c.id === conceptId),
    valid = regionSchema.safeParse(points).success;
  function edited(next: Mark[]) {
    selectionEdit.current++;
    selectionKey.current = crypto.randomUUID();
    setPoints(next);
    setDirty(true);
    setMessage("");
  }
  function choosePhoto(p: Photo, discard = false) {
    if (!discard && dirty && !confirm("Leave without saving the marked area?"))
      return;
    selectionEdit.current++;
    selectionKey.current = crypto.randomUUID();
    setPhotoId(p.id);
    setPoints(p.region || []);
    setMaterial(p.material || "wood");
    setBrief(p.brief || "");
    setStep("photo");
    setConceptId("");
    setDirty(false);
    setConsent(false);
    setMarking(false);
    setError("");
    setMessage("");
  }
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e: any) {
      if (mounted.current) setError(e.message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function upload(file: File) {
    if (dirty && !confirm("Leave without saving the marked area?")) return;
    await perform(async () => {
      const base64 = await uploadablePhoto(file);
      const p = await api<Photo>(base + "/photos", "POST", {
        name: file.name,
        base64,
      });
      await load();
      choosePhoto(p, true);
      setStep("area");setMarking(true);
      setMessage(
        "Photo saved privately to this project.",
      );
    });
  }
  function chooseConcept(c: Concept) {
    const p = data?.photos.find((p) => p.id === c.photoId);
    if (!p) return;
    if (dirty && !confirm("Leave without saving the marked area?")) return;
    setPhotoId(p.id);
    setPoints(c.region);
    setMaterial(c.material);
    setBrief(c.brief || p.brief || "");
    setStep("preview");
    setDirty(false);
    setConceptId(c.id);
    setConsent(false);
    setMarking(false);
    selectionKey.current = crypto.randomUUID();
  }
  function go(next:typeof step){
    if(next==='area'&&!photo)return;if(next==='changes'&&!valid)return;
    if(next==='area'||next==='changes'){setConceptId('');setConsent(false);selectionKey.current=crypto.randomUUID();if(next==='area')setMarking(true);}
    setStep(next);setError('');
  }
  async function saveChanges(){
    if(!photo)return;
    await perform(async()=>{
      const edit=selectionEdit.current;
      await api(`${base}/photos/${photo.id}/mark`,'PUT',{region:points,material,brief:brief.trim()});
      await load();
      if(selectionEdit.current===edit){setDirty(false);setMarking(false);setStep('preview');setMessage('Your photo and changes are saved privately to this project.');}
    });
  }
  const colorChoices = [
    {id:'ivory',name:'Warm ivory',hex:'#E3DDCA'}, {id:'sage',name:'Soft sage',hex:'#9CAB91'},
    {id:'forest',name:'Deep forest',hex:'#365848'}, {id:'cedar',name:'Cedar brown',hex:'#9B7356'},
    {id:'charcoal',name:'Slate charcoal',hex:'#586162'}, {id:'terracotta',name:'Clay terracotta',hex:'#BA8068'},
  ];
  async function saveColorStudy() {
    if (!photo || !valid || dirty) return;
    await perform(async () => {
      const c = await api<Concept>(base+'/color-studies','POST',{photoId:photo.id,region:points,color:finishColor});
      await load(); setConceptId(c.id); setStep('preview'); setMessage('Color study saved privately to this project. This is not a realistic remodel rendering.');
    });
  }
  const steps=[['photo','Photo'],['area','Area'],['changes','Changes'],['preview','Preview']] as const;
  const ready=concept?.status==='ready'&&!!concept.imageUrl;
  const selectedPending=concept&&['queued','running'].includes(concept.status);
  const chooseFile=(capture=false)=><label className={'btn '+(capture?'primary':'secondary')}><span>{capture?<Camera size={19}/>:<Upload size={18}/>} {capture?'Take a photo':'Upload a photo'}</span><input aria-label={capture?'Take property photo':'Upload property photo'} className="visually-hidden" type="file" accept="image/*" capture={capture?'environment':undefined} disabled={busy} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void upload(f);}}/></label>;
  const editBrief=(value:string)=>{setBrief(value);edited(points);};
  return <section className="remodel-workspace photo-flow">
    <header className="photo-flow-heading"><span className="eyebrow"><Camera size={14}/> PHOTO PREVIEW</span><h2>{step==='photo'?'Start with your property.':step==='area'?'Show us the area.':step==='changes'?'Make it your vision.':'See what’s possible.'}</h2><p>{step==='photo'?'A real photo. A clearer picture of what comes next.':step==='area'?'Tap around the part you want to change.':step==='changes'?'Tell us the materials, finishes and changes you have in mind.':'Your original photo and requested changes stay together.'}</p></header>
    <nav className="photo-steps" aria-label="Photo preview steps">{steps.map(([key,label],i)=><button key={key} type="button" aria-current={step===key?'step':undefined} disabled={busy||(key!=='photo'&&!photo)||(key==='changes'&&!valid)||(key==='preview'&&(!photo||dirty||!valid))} onClick={()=>go(key)}><span>{i+1}</span>{label}</button>)}</nav>
    {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="photo-feedback" role="status"><Check size={16}/>{message}</p>}
    {step==='photo'&&<>
      <article className="photo-start-card panel">
        {photo?<div className="photo-selected"><img src={photo.imageUrl} alt="Your saved original property photo"/><span>ORIGINAL PHOTO</span></div>:<div className="photo-empty-art"><span className="photo-camera-icon"><Camera size={35} strokeWidth={1.4}/><i><ImagePlus size={15}/></i></span><h3>Your property comes first.</h3><p>Take a photo on site, or choose one<br/>from your phone.</p></div>}
        <div className="photo-start-actions">{chooseFile(true)}{chooseFile()}</div>
        {photo&&<button className="btn primary photo-next" onClick={()=>go('area')}>Use this photo <ArrowRight size={18}/></button>}
        <div className="photo-private"><LockKeyhole size={13}/><span>Private to this project. Your original is kept safe.</span></div>
      </article>
      {!data?<div className="photo-service-note">Checking concept availability…</div>:!data.provider.available?<div className="photo-service-note"><span className="service-dot"/><div><strong>Realistic rendering is unavailable.</strong><p>An approved rendering service must be connected first. You can save photos and plan changes; no photos are sent for generation.</p></div></div>:<div className="photo-service-note available"><Check size={16}/><div><strong>Realistic concepts are available.</strong><p>A photo is sent for processing only when you approve a generation.</p></div></div>}
    </>}
    {photo&&step==='area'&&<article className="panel photo-area-card">
      <div className="photo-section-line"><h3>Mark the area to remodel</h3><span className={valid?'area-good':''}>{valid?'Area marked':`${points.length} corners`}</span></div>
      <div className="photo-marker" style={{aspectRatio:`${photo.width}/${photo.height}`}}>
        <img src={photo.imageUrl} alt="Original property photo to mark" draggable={false}/>
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" role="img" aria-label="Mark remodeling area" data-testid="remodel-marker" style={{touchAction:marking?'none':'pan-y'}} onPointerDown={e=>{if(busy||!marking)return;e.preventDefault();const r=e.currentTarget.getBoundingClientRect();if(points.length<64)edited([...points,{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}]);}}>
          {points.length>1&&<polygon points={points.map(p=>`${p.x},${p.y}`).join(' ')} fill="rgba(151,190,139,.26)" stroke="#f4d979" strokeWidth=".006"/>}{points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r=".009" fill="#fff8df" stroke="#184b39" strokeWidth=".003"/>)}
        </svg>
      </div>
      <p className="photo-help">Tap at least three corners around the change. The rest of the property will stay as it is.</p>
      <div className="photo-mark-actions"><button className="btn secondary" disabled={!points.length||busy} onClick={()=>edited(points.slice(0,-1))}><RotateCcw size={15}/>Undo last point</button><button className="text-button" disabled={busy} onClick={()=>edited([])}>Start again</button></div>
      {!valid&&points.length>=3&&<p className="error" role="alert">Choose an outline that doesn’t cross itself and leaves some of the photo unmarked.</p>}
      <button className="btn primary photo-next" disabled={!valid||busy} onClick={()=>go('changes')}>Continue <ArrowRight size={18}/></button>
    </article>}
    {photo&&step==='changes'&&<article className="panel photo-changes-card">
      <div className="photo-brief-source"><img src={photo.imageUrl} alt="Your original project photo"/><div><span className="eyebrow">YOUR ORIGINAL PHOTO</span><strong>Area selected <Check size={14}/></strong><button className="text-button" onClick={()=>go('area')}>Edit area</button></div></div>
      <label className="photo-brief-label">What would you like to change?<textarea aria-label="Describe your changes" value={brief} maxLength={2000} rows={5} disabled={busy||!!conceptId} placeholder="For example: Replace this fence with 6-foot cedar boards and a warm brown finish. Keep the gate where it is." onChange={e=>editBrief(e.target.value)}/></label>
      <div className="photo-brief-meta"><span>Materials, colors and details you care about.</span><span>{brief.length}/2,000</span></div>
      <div className="photo-ideas">{[['Cedar fence','Replace the marked fence with vertical cedar boards and a warm natural finish. Keep the existing gate position.'],['Glass railing','Replace the marked railing with clear glass panels and slim dark metal fixings. Keep the existing stairs and layout.'],['Fresh paint','Repaint the marked wall with a warm ivory finish. Keep the existing trim and all unmarked surfaces unchanged.'],['New flooring','Replace the marked flooring with natural oak-look planks. Keep all unmarked walls, doors and furniture unchanged.']].map(([label,text])=><button key={label} type="button" disabled={busy||!!conceptId} onClick={()=>editBrief(text)}>{label}</button>)}</div>
      <button className="btn primary photo-next" disabled={!valid||brief.trim().length<10||busy||!!conceptId} onClick={()=>void saveChanges()}>{busy?'Saving…':'Save & review'} <ArrowRight size={18}/></button>
    </article>}
    {photo&&step==='preview'&&<article className="panel photo-review-card">
      {ready&&concept?.imageUrl?<><div className="photo-section-line"><h3>Before & after</h3><span className="area-good"><Check size={13}/>Saved to project</span></div><div className="photo-comparison" style={{aspectRatio:`${photo.width}/${photo.height}`}}><img src={photo.imageUrl} alt="Before — actual saved property photo"/><img src={concept.imageUrl} alt={concept.colorStudy?"After — local finish color study, not photorealistic":"After — AI renovation concept on this property"} style={{clipPath:`inset(0 0 0 ${comparison}%)`}}/><span className="comparison-before">Before</span><span className="comparison-after">{concept.colorStudy?"Color study":"After concept"}</span><div className="comparison-divider" style={{left:comparison+'%'}}/></div><label className="field"><span>Compare your property</span><input type="range" aria-label="Before and after comparison" min="0" max="100" value={comparison} onChange={e=>setComparison(Number(e.target.value))}/></label></>:<div className="photo-selected"><img src={photo.imageUrl} alt="Original property photo awaiting a real concept"/><span>YOUR ORIGINAL · SAVED PRIVATELY</span></div>}
      <div className="photo-review-brief"><span className="eyebrow">THE CHANGES YOU WANT</span><p>{brief||'The marked area of your property.'}</p><button className="text-button" onClick={()=>{setConceptId('');setStep('changes');setConsent(false);selectionKey.current=crypto.randomUUID();}}>Edit changes</button></div>
      {valid&&!dirty&&<section className="photo-local-study" aria-label="Local finish color study">
        <span className="eyebrow">NO AI OR ADDITIONAL COST</span>
        <h3>Try a finish on this photo</h3>
        <p>Apply a simple color simulation to the area you marked. It does not remove walls, install railings, or replace actual materials.</p>
        <div className="photo-color-swatches" role="group" aria-label="Choose finish color">{colorChoices.map(c=><button key={c.id} type="button" title={c.name} aria-label={c.name} aria-pressed={finishColor===c.id} onClick={()=>setFinishColor(c.id)} style={{background:c.hex}} />)}</div>
        <p className="photo-color-selected">{colorChoices.find(c=>c.id===finishColor)?.name}</p>
        <button className="btn secondary photo-next" type="button" disabled={busy} onClick={()=>void saveColorStudy()}>Save color study to project <ArrowRight size={17}/></button>
      </section>}
      {!ready&&<div className="photo-generation-box">
        {!data?.provider.available?<><span className="photo-status-pill">GENERATION UNAVAILABLE</span><h3>No image service is connected.</h3><p>Your original and changes are saved. Nothing has been sent for generation, and no sample result will be substituted.</p></>:selectedPending?<><span className="photo-status-pill active">CREATING YOUR CONCEPT</span><h3>Your property, reimagined.</h3><p>This can take a few minutes. You can safely leave and return to this project.</p></>:concept?.status==='failed'?<><h3>This concept couldn’t be created.</h3><p>{concept.error}</p></>:<><h3>Ready to create your concept.</h3><p>Generate a realistic change from your photo and the area you marked.</p></>}
        {data?.provider.available&&!selectedPending&&!conceptId&&<><label className="remodel-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>I approve sending this photo and marked area to {data.provider.name||'the configured image service'} to create this concept.</span></label><details className="photo-processing-details"><summary>Processing details</summary><p>{data.provider.notice}</p></details></>}
        <button className="btn primary photo-next" disabled={busy||!valid||dirty||!consent||!!conceptId||!data?.provider.available||data.provider.remainingAttempts<1||!!pending} onClick={()=>perform(async()=>{const result=await api<Concept>(base+'/concepts','POST',{photoId:photo.id,region:points,material,brief:brief.trim(),consent,requestKey:selectionKey.current});await load();setConceptId(result.id);setConsent(false);setMessage('Concept requested. Your original photo is kept safe.');})}><WandSparkles size={18}/>{selectedPending?'Creating concept…':'Generate concept'}</button>
        {data?.provider.available&&data.provider.remainingAttempts<1&&<p className="photo-help">Image generation is paused. Your photos and changes are saved.</p>}
      </div>}
      <div className="photo-export">{ready&&concept?<a className="btn primary photo-next" href={`/api${base}/concepts/${concept.id}/pdf`} download><Download size={18}/>Export homeowner PDF</a>:<><button className="btn secondary photo-next" disabled><Download size={18}/>Export homeowner PDF</button><p>A real completed concept is required for a before-and-after PDF.</p></>}</div>
      {ready&&concept&&<details className="photo-proposal-details"><summary>Add this concept to a draft proposal</summary><p>Your accepted contracts stay protected.</p><label className="field"><span>Draft proposal</span><select aria-label="Draft proposal" value={proposalId} onChange={e=>setProposalId(e.target.value)}><option value="">Choose a draft…</option>{proposals.filter(p=>p.status==='draft').map(p=><option value={p.id} key={p.id}>{p.title}</option>)}</select></label>{!proposals.some(p=>p.status==='draft')&&<p>Create a draft in the Proposal tab first.</p>}<button className="btn secondary" disabled={busy||!proposalId} onClick={()=>perform(async()=>{const p=proposals.find(p=>p.id===proposalId);if(!p)return;await api(`${base}/concepts/${concept.id}/proposal`,'POST',{proposalId:p.id,revision:p.revision});onDirty(false);await onProposal(p.id);})}>Use this concept in proposal</button></details>}
    </article>}
    {!!data?.photos.length&&<section className="photo-saved-section"><h3>Project photos <span>{data.photos.length}</span></h3><div className="photo-library">{data.photos.map(p=><button key={p.id} className={p.id===photoId?'selected':''} disabled={busy} onClick={()=>choosePhoto(p)}><img src={p.imageUrl} alt={p.name}/><span>{p.name}</span></button>)}</div></section>}
    {!!data?.concepts.length&&<section className="photo-saved-section"><h3>Saved concepts <span>{data.concepts.length}</span></h3><div className="concept-library">{data.concepts.map(c=><button key={c.id} className={c.id===conceptId?'selected':''} disabled={busy} onClick={()=>chooseConcept(c)}>{c.imageUrl?<img src={c.imageUrl} alt="Saved concept created from this project photo"/>:<span className="concept-pending-icon"><WandSparkles size={22}/></span>}<strong>{c.status==='ready'?(c.colorStudy?'Local finish study':'Property concept'):c.status==='failed'?'Couldn’t create concept':'Concept in progress'}</strong><span>{new Date(c.createdAt).toLocaleDateString()}</span></button>)}</div></section>}
    <details className="photo-advanced"><summary>Advanced tools</summary><button className="text-button" type="button" onClick={onAdvanced}><Ruler size={16}/>Measure from a plan <ChevronRight size={15}/></button><p>Optional reference measurements for contractors.</p></details>
  </section>;
}
