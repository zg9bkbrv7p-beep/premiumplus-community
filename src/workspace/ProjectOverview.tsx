import {useEffect,useState} from 'react';
import ProjectOperations from './ProjectOperations';
import {Camera,FileText,Activity,ArrowUpRight,Clock,Check,ShieldCheck,Ruler,ChevronRight,MapPin,Compass,ClipboardCheck,LockKeyhole} from 'lucide-react';
import {api,date,type Project,type Proposal} from '../api';
import './project-navigation.css';
import './card-shine.css';
import {useCardShine,shineColors} from './useCardShine';
import{proposalReadiness}from'../../shared/proposalReadiness';
export const stageLabel=(p:Project)=>p.archivedAt?'Archived':p.status==='completed'?'Completed':p.status==='active'?'Active':p.latestProposalStatus==='shared'?'Awaiting approval':'Planning';
export default function ProjectOverview({project:p,onTab,onEdit}:{project:Project;onTab:(tab:string)=>void;onEdit?:()=>void}){
 const shine=useCardShine();
 const[live,setLive]=useState<any>(null),[company,setCompany]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{let current=true;Promise.all([api(`/projects/${p.id}/live`),api('/company')]).then(([l,c])=>{if(current){setLive(l);setCompany(c);}}).catch(e=>{if(current)setError(e.message);});return()=>{current=false;};},[p.id]);
 const latest=p.proposals?.[0],contract=live?.originalContract||p.agreements?.[0],approved=contract?.snapshot?.proposal;
 const selected=contract?.snapshot?.selectedIds||[],selections=approved?.options?.filter((o:any)=>selected.includes(o.id))||[];
 const pending=live?.decisions?.filter((d:any)=>d.status==='pending')||[];
 const events=p.events||[];
 const setupIssues=!contract&&latest?.status!=='shared'?proposalReadiness(latest,p.address):[];
 const proposalLabel=latest?({draft:'Draft',shared:'Awaiting approval',accepted:'Accepted'}[latest.status]):'Not started';
 const workflow=[
  {label:'Project created',done:true},
  {label:'Proposal prepared',done:!!latest&&setupIssues.length===0},
  {label:'Homeowner approved',done:!!contract||latest?.status==='accepted'},
  {label:'Work in progress',done:p.status==='active'||p.status==='completed'},
 ];
 const achieved=workflow.filter(step=>step.done).length;
 const currentAction=!p.address?{title:'Add your property address',copy:'Complete your project details before the client review.',tab:'details',icon:MapPin}:
  !latest?{title:'Prepare the first proposal',copy:'Add the real scope, customer details and pricing.',tab:'proposal',icon:FileText}:
  setupIssues.length?{title:'Finish proposal details',copy:`${setupIssues.length} required ${setupIssues.length===1?'item remains':'items remain'} before sharing.`,tab:'proposal',icon:ClipboardCheck}:
  latest.status==='draft'?{title:'Review the proposal',copy:'Double-check the final scope and pricing before client sharing.',tab:'proposal',icon:FileText}:
  latest.status==='shared'&&!contract?{title:'Await homeowner approval',copy:'The proposal is shared. View its current approval status.',tab:'proposal',icon:Clock}:
  {title:'Open Live Project',copy:'Review updates, selections and approved changes.',tab:'live',icon:Activity};
 const CurrentIcon=currentAction.icon;
 function openCurrentAction(){if(currentAction.tab==='details'&&onEdit){onEdit();return;}onTab(currentAction.tab==='details'?'proposal':currentAction.tab);}
 return <div className="project-content project-overview" ref={shine.root} data-shine-color={shine.color} onPointerMove={shine.onPointerMove}>
  {error&&<p className="error" role="alert">Project summary could not be refreshed: {error}</p>}
  <section className="project-summary-grid motion-edge-card" aria-label="Project summary">
   <Summary label="CURRENT STAGE" value={stageLabel(p)}/><Summary label="PROPOSAL" value={proposalLabel}/>
   <Summary label="HOMEOWNER APPROVALS" value={p.pendingHomeownerDecisions===undefined?'—':`${p.pendingHomeownerDecisions} pending`}/><Summary label="PROJECT PHOTOS" value={p.photoCount===undefined?'—':String(p.photoCount)}/>
  </section>
  <section className="project-quick-actions motion-edge-card" aria-label="Quick Actions"><h2>Quick Actions</h2><div>{[[Camera,'Open Photo Preview','remodel'],[FileText,'Open Proposal','proposal'],[Activity,'View Live Project','live']].map(([Icon,label,tab]:any)=><button key={tab} className="btn secondary" onClick={()=>onTab(tab)}><Icon size={17}/>{label}<ChevronRight size={15}/></button>)}</div></section>
  <section className="premium-project-guide motion-edge-card" aria-label="Project guide">
    <div className="premium-guide-header"><span className="premium-guide-eyebrow"><Compass size={13}/> YOUR PROJECT GUIDE</span><span className="premium-guide-progress">{achieved} of {workflow.length} milestones</span></div>
    <div className="premium-guide-steps" role="list" aria-label="Recorded workflow milestones">{workflow.map((step,index)=><div role="listitem" key={step.label} className={'premium-guide-step '+(step.done?'is-complete':'')}><span aria-hidden="true" className="premium-guide-mark">{step.done?<Check size={14}/>:String(index+1).padStart(2,'0')}</span><span>{step.label}</span></div>)}</div>
    <div className="premium-guide-next"><span className="premium-guide-next-icon"><CurrentIcon size={19}/></span><div><strong>{currentAction.title}</strong><small>{currentAction.copy}</small></div><button className="premium-guide-next-button" type="button" onClick={openCurrentAction} aria-label={currentAction.title}>Continue <ArrowUpRight size={15}/></button></div>
    <p className="premium-guide-disclaimer"><LockKeyhole size={12}/> Milestones reflect saved project records, not construction completion.</p>
  </section>
  <section className="panel project-details-panel motion-edge-card"><div className="overview-section-title"><h2>Project Details</h2><ShieldCheck size={17}/></div><dl className="project-detail-list"><Detail label="Homeowner" value={contract?.name||latest?.customerName||'Not recorded'}/><Detail label="Property" value={p.address||'Address not recorded'}/><Detail label="Schedule" value={p.startDate?`${p.startDate}${p.adjustedEndDate?' — '+p.adjustedEndDate:''}`:'Not scheduled'}/><Detail label="Contractor" value={company?.name||'Loading…'}/>{company?.phone&&<Detail label="Contact" value={company.phone}/>}</dl><p className="overview-detail-note">{p.description||'No project description recorded.'}</p></section>
  <section className="panel scope-snapshot motion-edge-card"><div className="overview-section-title"><h2>Selections & Scope</h2>{approved&&<span className="saved-pill"><Check size={12}/>Approved</span>}</div>{approved?<><p className="saved-scope">{approved.scope||'No scope text in the signed proposal.'}</p><div className="scope-materials">{approved.items.map((item:any)=><div key={item.id}><Check size={13}/><span>{item.label}</span><small>Qty {item.quantity}</small></div>)}</div>{selections.map((o:any)=><p key={o.id} className="selected-option"><Check size={13}/>{o.label}</p>)}{live?.decisions?.filter((d:any)=>d.kind==='selection'&&d.status==='approved').map((d:any)=><p key={d.id} className="selected-option"><Check size={13}/>{d.title}: {d.options.find((o:any)=>o.id===d.option_id)?.label||'Recorded selection'}</p>)}</>:<div className="overview-empty"><FileText size={22}/><div><strong>No approved scope yet</strong><p>Accepted materials, scope and homeowner selections will appear here. Draft terms remain in Proposal.</p></div></div>}</section>
  <section className="panel overview-next motion-edge-card"><div className="overview-section-title"><h2>Next Steps</h2><Clock size={17}/></div>{setupIssues.length>0&&<div role="status"><strong>{setupIssues.length} setup items need attention</strong><ul>{setupIssues.map(i=><li key={i.key} className="overview-detail-note">{i.message}</li>)}</ul><button className="text-button" onClick={()=>onTab('proposal')}>Complete proposal setup</button></div>}{pending.length?pending.slice(0,3).map((d:any)=><button className="overview-next-row" key={d.id} onClick={()=>onTab('live')}><span className="pending-dot"/><span><strong>{d.title}</strong><small>Awaiting homeowner{d.due_date?' · Due '+d.due_date:''}</small></span><ChevronRight size={16}/></button>):<p className="overview-detail-note">{p.pendingHomeownerDecisions===0?'No homeowner approvals are pending.':'Open Live Project to review current decisions.'}</p>}{!contract&&setupIssues.length===0&&<button className="overview-next-row" onClick={()=>onTab('proposal')}><FileText size={17}/><span><strong>{latest?'Review the proposal':'Create a proposal'}</strong><small>{latest?.status==='shared'?'Waiting for homeowner acceptance.':'Confirm scope and pricing before sharing.'}</small></span><ChevronRight size={16}/></button>}</section>
  <section className="panel recent-project-activity motion-edge-card"><div className="overview-section-title"><h2>Recent Activity</h2><button className="text-button" onClick={()=>onTab('activity')}>View history</button></div>{events.length?events.slice(0,4).map(e=><div key={e.id} className="recent-activity-row"><span className="activity-point"/><div><strong>{e.label}</strong><time dateTime={e.created_at}>{date(e.created_at)}</time></div></div>):<p className="overview-detail-note">No project activity recorded yet.</p>}{live?.updates?.slice(0,2).map((u:any)=><div className="recent-activity-row" key={u.id}><span className="activity-point"/><div><strong>{u.title}</strong><p>{u.body}</p><time>{date(u.created_at)}</time></div></div>)}</section>
  <details className="project-advanced contractor-operations"><summary><ClipboardCheck size={16}/> Contractor Toolkit · Follow-ups, Reports & Help</summary><ProjectOperations projectId={p.id} onTab={onTab} editable={p.status!=='completed'&&!p.archivedAt}/></details>
  <details className="project-advanced"><summary><Ruler size={16}/>Advanced Tools</summary><div><button onClick={()=>onTab('estimate')}>Estimates & pricing <ArrowUpRight size={15}/></button><button onClick={()=>onTab('planlab')}>Measurements & calibration <ArrowUpRight size={15}/></button><button onClick={()=>onTab('design')}>3D Wall Design <ArrowUpRight size={15}/></button><p>Optional contractor tools. Original proposals, contracts and payments stay connected to this project.</p><div className="card-shine-controls"><fieldset className="shine-color-picker"><legend>Edge highlight color</legend><div>{shineColors.map(c=><label key={c.id} data-color={c.id}><input type="radio" name="card-edge-color" value={c.id} checked={shine.color===c.id} onChange={()=>shine.chooseColor(c.id)}/><span className="shine-color-swatch" aria-hidden="true"/><span>{c.label}</span></label>)}</div></fieldset>{shine.reduced?<small>Card shine stays still with Reduce Motion.</small>:<>{shine.supported&&<button type="button" onClick={shine.toggleTilt} disabled={shine.requesting} aria-pressed={shine.tilt}>{shine.requesting?'Enabling tilt shine…':shine.tilt?'Disable tilt shine':'Enable tilt shine'}</button>}<small>{shine.supported?'Optional phone tilt moves the card edges. Motion stays on this device.':'Touch or move the pointer across a card to move its edge highlight.'}</small>{shine.notice&&<p role="status">{shine.notice}</p>}</>}</div></div></details>
 </div>;
}
function Summary({label,value}:{label:string;value:string}){return <div className="project-summary-cell"><span>{label}</span><strong>{value}</strong></div>;}
function Detail({label,value}:{label:string;value:string}){return <div><dt>{label}</dt><dd>{value}</dd></div>;}
