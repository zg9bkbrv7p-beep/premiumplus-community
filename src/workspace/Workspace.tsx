import {useEffect,useState} from 'react';
import {Plus,Search,FolderOpen,FileText,Clock,ArrowRight,ChevronRight,ShieldCheck,Activity,Camera,Sparkles,ArrowUpRight,Image as ImageIcon,RotateCcw} from 'lucide-react';
import {api,type Project,date} from '../api';
import {Modal,Field} from '../ui';
import {stageLabel} from './ProjectOverview';
import './project-navigation.css';
import './premium-polish.css';
export default function Workspace({user,page,onOpen}:{user:any;page:string;onOpen:(p:Project,tab?:string)=>void}){
 const[projects,setProjects]=useState<Project[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[create,setCreate]=useState(false),[search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[busy,setBusy]=useState(false),[trashed,setTrashed]=useState<Project[]>([]),[trashBusy,setTrashBusy]=useState<string|null>(null),[trashLoading,setTrashLoading]=useState(false);
 useEffect(()=>{api<Project[]>('/projects?includeArchived=1').then(setProjects).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 useEffect(()=>{if(filter!=='trash'||user.role!=='owner')return;let active=true;setTrashLoading(true);api<Project[]>('/projects/trash').then(rows=>{if(active)setTrashed(rows)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setTrashLoading(false)});return()=>{active=false}},[filter,user.role]);
 useEffect(()=>{setFilter('all');setSearch('')},[page]);
 async function restoreTrash(p:Project){setTrashBusy(p.id);setError('');try{await api(`/projects/${p.id}/restore-trash`,'POST',{});setTrashed(current=>current.filter(x=>x.id!==p.id));setProjects(await api<Project[]>('/projects?includeArchived=1'));}catch(e:any){setError(e.message)}finally{setTrashBusy(null)}}
 async function add(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');try{const p=await api('/projects','POST',Object.fromEntries(new FormData(e.currentTarget)));onOpen(p,'overview');}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 const dashboard=page==='overview',proposals=page==='proposals';
 const current=projects.filter(p=>!p.archivedAt),archived=projects.filter(p=>!!p.archivedAt);
 const shown=(filter==='trash'?trashed:filter==='archived'?archived:current).filter(p=>(p.name+' '+p.address).toLowerCase().includes(search.toLowerCase())&&(filter==='all'||filter==='archived'||filter==='trash'||(filter==='active'?p.status==='active':p.status!=='completed'&&p.status!=='active')));
 const pending=current.filter(p=>(p.pendingHomeownerDecisions||0)>0),pendingCount=current.reduce((n,p)=>n+(p.pendingHomeownerDecisions||0),0),drafts=current.reduce((n,p)=>n+(p.draftProposalCount||0),0);
 const count=(n:number)=>loading||error?'—':String(n);
 return (<>
  <div className="page-heading contractor-page-heading"><div><div className="eyebrow">{dashboard?`WELCOME BACK, ${user.name.split(' ')[0].toUpperCase()}`:'YOUR PRIVATE WORKSPACE'}</div><h1>{dashboard?'Dashboard':proposals?'Proposals':'Projects'}</h1><p>{dashboard?'Your projects and next steps, in one place.':proposals?'Open a project to review, import or share its proposal.':'Find a project and pick up where you left off.'}</p></div><button className="btn primary" onClick={()=>setCreate(true)}><Plus size={16}/>New project</button></div>
  <div className="contractor-workspace">
  {error&&<p className="error" role="alert">{error}</p>}
  {dashboard&&<><section className="dashboard-status-grid" aria-label="Workspace status"><DashboardMetric label="ACTIVE PROJECTS" value={count(current.filter(p=>p.status==='active').length)} icon={<FolderOpen size={18}/>}/><DashboardMetric label="PENDING DECISIONS" value={count(pendingCount)} icon={<Clock size={18}/>}/><DashboardMetric label="DRAFT PROPOSALS" value={count(drafts)} icon={<FileText size={18}/>}/></section>
  <section className="panel dashboard-pending"><div className="overview-section-title"><h2>Pending Decisions</h2><span className="saved-pill">Homeowner responses</span></div>{loading?<p>Loading project status…</p>:error?<p>Project status is unavailable.</p>:pending.length?pending.map(p=><button className="overview-next-row" key={p.id} onClick={()=>onOpen(p,'live')}><span className="pending-dot"/><span><strong>{p.name}</strong><small>{p.pendingHomeownerDecisions} pending · Awaiting homeowner</small></span><ChevronRight size={17}/></button>):<div className="dashboard-caught-up"><ShieldCheck size={22}/><div><strong>Nothing needs attention now.</strong><p>No homeowner decisions are pending.</p></div></div>}</section></>}
  <section className="dashboard-project-list"><div className="overview-section-title"><h2>{dashboard?'Your Projects':proposals?'Project Proposals':'All Projects'} <span className="project-list-count">{filter==='trash'?trashed.length:filter==='archived'?archived.length:current.length}</span></h2></div><label className="project-search"><Search size={16}/><input aria-label="Search projects" placeholder="Search projects…" value={search} onChange={e=>setSearch(e.target.value)}/></label>{!proposals&&<div className="project-list-filters">{[...([['all','All projects'],['active','Active'],['planning','Planning'],['archived','Archived']]),...(user.role==='owner'?[['trash','Trash']]:[])].map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div>}
  {(filter==='trash'?trashLoading:loading)?<p>Opening your workspace…</p>:shown.length?shown.map(p=><div className="contractor-managed-project" key={p.id}><button type="button" disabled={filter==='trash'} className="contractor-project-row" onClick={()=>onOpen(p,proposals?'proposal':'overview')}><span className="project-row-symbol">{!proposals&&p.previewPhoto?.imageUrl?<img src={p.previewPhoto.imageUrl} alt="" loading="lazy" decoding="async"/>:proposals?<FileText size={21}/>:<FolderOpen size={21}/>}</span><span className="project-row-main"><strong>{p.name}</strong><small>{p.address||'Address not recorded'}</small><span className="project-row-meta">{proposals?`${p.proposalCount||0} proposal(s) · ${p.latestProposalStatus||'Not started'}`:`${p.pendingHomeownerDecisions||0} pending decisions · ${p.proposalCount||0} proposal(s)`}</span></span><span className="project-row-end"><span className="saved-pill">{stageLabel(p)}</span><ChevronRight size={17}/></span></button>{filter==='trash'&&<button type="button" className="btn secondary restore-project-action" disabled={trashBusy===p.id} onClick={()=>void restoreTrash(p)}><RotateCcw size={15}/>{trashBusy===p.id?'Restoring…':'Restore project'}</button>}</div>):<div className="panel contractor-empty"><FolderOpen size={25}/><h3>{search?'No matching projects':filter==='trash'?'Trash is empty':filter==='archived'?'No archived projects':archived.length?'No current projects':'No projects yet'}</h3><p>{search?'Try another project name or address.':filter==='trash'?'Trashed drafts remain here until restored; nothing is erased automatically.':filter==='archived'?'Archived projects stay here until you restore them.':archived.length?'Choose Archived to find and restore your saved projects.':'Create a project to keep its proposal, photos and decisions together.'}</p>{!search&&filter!=='archived'&&filter!=='trash'&&!archived.length&&<button className="btn primary" onClick={()=>setCreate(true)}>Create Your First Project</button>}</div>}
  </section>
  {dashboard&&current.length>0&&<section className="panel dashboard-actions"><h2>Quick Actions</h2>{current.length>0&&<button className="overview-next-row" onClick={()=>onOpen(current.find(p=>p.draftProposalCount)||current[0],'proposal')}><FileText size={18}/><span><strong>Continue a proposal</strong><small>{(current.find(p=>p.draftProposalCount)||current[0]).name}</small></span><ChevronRight size={16}/></button>}</section>}
  {dashboard&&<section className="premium-design-studio" aria-label="Photo Preview inspiration">
   <div className="premium-design-studio-image"><picture><source media="(min-width: 900px)" srcSet="/images/architectural-exterior-4k.webp" type="image/webp"/><img src="/images/architectural-exterior.jpg" alt="Contemporary home — architectural inspiration only" loading="lazy" decoding="async"/></picture><span><ImageIcon size={13}/> ARCHITECTURAL INSPIRATION</span></div>
   <div className="premium-design-studio-copy"><span className="premium-studio-kicker"><Sparkles size={14}/> CREATIVE WORKSPACE</span><h2>From a real photo to a clearer vision.</h2><p>Start with your customer's actual property photo. Mark the area and prepare a visual discussion before any work begins.</p><button className="btn premium-studio-action" type="button" onClick={()=>current.length?onOpen(current[0],'remodel'):setCreate(true)}>{current.length?'Open Photo Preview':'Create your first project'}<ArrowUpRight size={16}/></button><small>Project photos stay separate from architectural inspiration. Realistic rendering is not connected.</small></div>
  </section>}
  <div className="workspace-private-note"><ShieldCheck size={13}/>Only projects you can access appear here.</div></div>
      {create && (
        <Modal
          title="Give your vision a name."
          onClose={() => setCreate(false)}
        >
          <form onSubmit={add}>
            <Field
              label="Project name"
              name="name"
              placeholder="The Willow House"
              required
              maxLength={200}
              autoFocus
            />
            <Field
              label="Site address"
              name="address"
              placeholder="A place with possibility"
              maxLength={400}
            />
            <label className="field">
              <span>A little about the project</span>
              <textarea
                name="description"
                placeholder="What are you imagining?"
                maxLength={5000}
              />
            </label>
            {error && <div className="error">{error}</div>}
            <div className="modal-footer">
              <p>Keep this property’s photos, proposals and decisions together.</p>
              <button className="btn primary" disabled={busy}>
                Create project <ArrowRight size={17} />
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function DashboardMetric({label,value,icon}:{label:string;value:string;icon:React.ReactNode}){return <div className="dashboard-status-cell">{icon}<strong>{value}</strong><span>{label}</span></div>;}
export function PropertyPhotoCover({project}:{project:Project}){return <div className="property-photo-cover">{project.previewPhoto?<img src={project.previewPhoto.imageUrl} alt="Actual saved property photo"/>:<div className="property-photo-empty"><Camera size={34} strokeWidth={1.2}/><span>NO PROPERTY PHOTO SAVED</span></div>}</div>;}
