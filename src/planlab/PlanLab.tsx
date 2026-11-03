import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowRight,CheckCircle2,Download,FileText,Ruler,RotateCcw,UploadCloud} from 'lucide-react';
import type {Project} from '../api';
import {asProjectExport,calibrate,measure,type Calibration,type Point} from './measure';
import './planlab.css';

type Measurement={first:Point;second:Point;feet:number};

/** Contractor-only working surface: actual PDF attachment/save stays in ProposalEditor. */
export default function PlanLab({project,onMakeWall}:{project:Project;onProposal?:()=>void;onMakeWall?:(lengthFeet:number)=>void}){
  const canvas=useRef<HTMLCanvasElement>(null);
  const image=useRef<HTMLImageElement|null>(null);
  const [planName,setPlanName]=useState('');
  const [scale,setScale]=useState<Calibration|null>(null);
  const [measurements,setMeasurements]=useState<Measurement[]>([]);
  const [pending,setPending]=useState<Point[]>([]);
  const [referencePair,setReferencePair]=useState<[Point,Point]|null>(null);
  const [referenceFeet,setReferenceFeet]=useState('');
  const [mode,setMode]=useState<'calibrate'|'measure'>('calibrate');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const draw=useCallback(()=>{
    const c=canvas.current;if(!c)return;
    const ctx=c.getContext('2d');if(!ctx)return;
    ctx.clearRect(0,0,c.width,c.height);
    ctx.fillStyle='#f9faf5';ctx.fillRect(0,0,c.width,c.height);
    if(image.current) ctx.drawImage(image.current,0,0,c.width,c.height);
    else {
      ctx.strokeStyle='#bfd0c4';ctx.lineWidth=2;ctx.setLineDash([12,9]);ctx.strokeRect(70,70,c.width-140,c.height-140);ctx.setLineDash([]);
      ctx.fillStyle='#23523e';ctx.font='bold 23px system-ui';ctx.fillText('2D PLAN PREVIEW',90,135);
      ctx.font='17px system-ui';ctx.fillText('Choose a plan image to begin',90,175);
    }
    const line=(a:Point,b:Point,color:string,label:string)=>{
      ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      ctx.fillStyle='#fff';for(const p of [a,b]){ctx.beginPath();ctx.arc(p.x,p.y,7,0,2*Math.PI);ctx.fill();ctx.stroke();}
      ctx.font='bold 18px system-ui';const x=Math.max(12,Math.min(c.width-190,(a.x+b.x)/2+12));const y=Math.max(20,(a.y+b.y)/2-12);
      ctx.fillStyle='#fff';const w=ctx.measureText(label).width+14;ctx.fillRect(x-5,y-20,w,27);
      ctx.fillStyle=color;ctx.fillText(label,x,y);
    };
    if(scale)line(scale.first,scale.second,'#15805f',`${scale.referenceFeet} ft reference`);
    if(referencePair)line(referencePair[0],referencePair[1],'#2d6494','Enter reference in feet');
    measurements.forEach(m=>line(m.first,m.second,'#b16d27',`${m.feet.toFixed(1)} ft`));
    pending.forEach(p=>{ctx.fillStyle='#174b38';ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.fill();});
  },[scale,measurements,pending,referencePair]);
  useEffect(draw,[draw,planName]);
  function reset(){setScale(null);setMeasurements([]);setPending([]);setReferencePair(null);setReferenceFeet('');setMode('calibrate');setError('');setNotice('');}
  async function upload(file:File){
    setError('');setNotice('');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)) {setError('Choose a PNG, JPG, or WEBP plan image. For a PDF proposal use Import PDF in the proposal editor.');return;}
    if(file.size===0||file.size>10*1024*1024){setError('Plan image must be 10 MB or smaller.');return;}
    const url=URL.createObjectURL(file);const candidate=new Image();
    try{
      candidate.src=url;await candidate.decode();
      if(candidate.naturalWidth<20||candidate.naturalHeight<20)throw Error('Image is too small.');
      const ratio=Math.min(1,1400/candidate.naturalWidth,1400/candidate.naturalHeight);
      const c=canvas.current;
      if(!c)throw Error('Plan canvas unavailable.');
      c.width=Math.round(candidate.naturalWidth*ratio);c.height=Math.round(candidate.naturalHeight*ratio);
      image.current=candidate;setPlanName(file.name);reset();setNotice('Plan image opened on this device. Select two ends of a known distance to calibrate.');
      draw();
    }catch(e){setError(e instanceof Error?e.message:'Could not read the plan.');}finally{URL.revokeObjectURL(url);}
  }
  function selectPoint(ev:React.PointerEvent<HTMLCanvasElement>){
    if(!image.current)return;
    const c=canvas.current;if(!c)return;
    const b=c.getBoundingClientRect();if(b.width===0||b.height===0)return;
    const pt={x:Math.max(0,Math.min(c.width,(ev.clientX-b.left)*c.width/b.width)),y:Math.max(0,Math.min(c.height,(ev.clientY-b.top)*c.height/b.height))};
    const next=[...pending,pt];
    if(next.length<2){setPending(next);return;}
    setPending([]);setError('');
    if(mode==='calibrate'){
      setReferencePair([next[0],next[1]]);setNotice('Enter the real-world distance between those points.');
    }else{
      try{const feet=measure(next[0],next[1],scale!);setMeasurements(ms=>[...ms,{first:next[0],second:next[1],feet}]);setNotice(`Estimated length: ${feet.toFixed(2)} feet. Verify with an independent reference.`);}catch(e){setError(e instanceof Error?e.message:'Calibration required.');}
    }
  }
  function applyReference(){
    try{
      if(!referencePair)throw Error('Select two reference points first.');
      const value=calibrate(referencePair[0],referencePair[1],Number(referenceFeet));
      setScale(value);setMeasurements([]);setReferencePair(null);setMode('measure');setNotice('Scale set. Now select two points to estimate a distance.');setError('');
    }catch(e){setError(e instanceof Error?e.message:'Invalid reference.');}
  }
  function download(){
    const exportData=asProjectExport({projectId:project.id,projectName:project.name,address:project.address||'',planName,calibration:scale,measurements});
    const url=URL.createObjectURL(new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download=`premiumplus-plan-${project.id}.json`;
    document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
    setNotice('Working measurements exported. This did not modify your project or signed contract.');
  }
  return <section className="plan-lab">
    <header className="plan-lab-hero">
      <span className="eyebrow">OPTIONAL CONTRACTOR TOOL</span>
      <h2>Advanced measurements</h2>
      <p>Use your own plan image and a known reference distance to estimate lengths.</p>
      <div className="plan-lab-tags"><span><CheckCircle2 size={16}/> Existing project stays intact</span><span><CheckCircle2 size={16}/> Local working measurements</span></div>
    </header>
    <div className="plan-lab-columns">
      <article className="panel plan-lab-intro">
        <div className="plan-lab-number">YOUR PLAN IMAGE</div>
        <Ruler size={29}/><h3>Measure from your plan</h3>
        <p>Open a JPG, PNG or WEBP plot plan from your iPhone Files, calibrate two points against a known distance, then measure approximate lengths.</p>
        <label className="btn secondary plan-lab-upload"><UploadCloud size={17}/> Choose plan image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value='';}}/></label>
        
        <small>This working tool processes the image in your browser only. Measurements are not saved to the project database.</small>
      </article>
    </div>
    <article className="panel plan-lab-drawing">
      <div className="plan-lab-topline"><div><h3>Measure your plan</h3><p>{planName||'No plan image selected'}</p></div><span>{scale?'CALIBRATED':'NOT CALIBRATED'}</span></div>
      <div className="plan-lab-modes">
        <button className={mode==='calibrate'?'active':''} onClick={()=>{setMode('calibrate');setPending([]);setReferencePair(null);}}>Calibrate</button>
        <button className={mode==='measure'?'active':''} disabled={!scale} onClick={()=>{setMode('measure');setPending([]);setReferencePair(null);}}>Measure</button>
        <button onClick={reset}><RotateCcw size={15}/> Clear marks</button>
      </div>
      <canvas ref={canvas} width={1000} height={660} onPointerUp={selectPoint} aria-label="Plot plan image; tap two points to calibrate or measure" style={{touchAction:'manipulation'}}/>
      <p className="plan-lab-hint">{mode==='calibrate'?'Tap two points that you know the real-world distance between.':'Tap any two points to measure the distance between them.'}</p>
      {referencePair&&<div className="plan-lab-calibration"><label>Known distance in feet <input type="number" min="0.01" step="any" inputMode="decimal" value={referenceFeet} onChange={e=>setReferenceFeet(e.target.value)} placeholder="e.g. 40"/></label><button className="btn primary" onClick={applyReference}>Set scale</button></div>}
      {error&&<p className="error" role="alert">{error}</p>}
      {notice&&<p className="plan-lab-notice" role="status">{notice}</p>}
      {scale&&<p className="plan-lab-scale">Reference: {scale.referenceFeet} ft · {scale.feetPerPixel.toFixed(5)} ft per image pixel</p>}
      {measurements.length>0&&<div className="plan-lab-results"><h4>Measured segments</h4>{measurements.map((m,i)=><div key={i} className="plan-lab-measured-wall"><span>#{i+1} · {m.feet.toFixed(2)} ft</span>{onMakeWall&&<button type="button" className="btn secondary" disabled={m.feet * 0.3048 > 100 || m.feet * 0.3048 < 0.2} onClick={()=>onMakeWall(m.feet)}>Design wall in 3D <ArrowRight size={15}/></button>}</div>)}</div>}
      <div className="plan-lab-footer"><p><strong>Estimate only.</strong> Confirm critical dimensions on site before quoting, ordering materials or construction.</p><button className="btn secondary" disabled={!planName} onClick={download}><Download size={17}/> Export reviewed plan JSON</button></div>
    </article>
  </section>;
}
