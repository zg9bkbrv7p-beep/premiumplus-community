import {useEffect,useRef,useState,type PointerEvent} from 'react';

type OrientationAccess = typeof DeviceOrientationEvent & {requestPermission?:()=>Promise<'granted'|'denied'>};
const clamp=(n:number)=>Math.max(-1,Math.min(1,n));
const preferenceKey='premium-commercial:tilt-shine';
export const shineColors=[{id:'gold',label:'Gold'},{id:'silver',label:'Silver'},{id:'green',label:'Green'},{id:'blue',label:'Blue'},{id:'purple',label:'Purple'}] as const;
type ShineColor=typeof shineColors[number]['id'];
const colorKey='premium-commercial:shine-color';
let rememberedColor:ShineColor='gold';
function readColor():ShineColor{try{return shineColors.find(c=>c.id===localStorage.getItem(colorKey))?.id||'gold';}catch{return rememberedColor;}}

let pagePermissionGranted=false;
let rememberedPreference=false;
function readPreference(){try{return localStorage.getItem(preferenceKey)==='on';}catch{return rememberedPreference;}}
function savePreference(on:boolean){rememberedPreference=on;try{localStorage.setItem(preferenceKey,on?'on':'off');}catch{/* Keep navigation working when browser storage is unavailable. */}}


/** Decorative only: no sensor values are stored or transmitted. */
export function useCardShine(){
 const root=useRef<HTMLDivElement>(null),frame=useRef(0),pending=useRef(135),alive=useRef(true),baseline=useRef<{gamma:number;beta:number}|null>(null);
 const[reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const[wanted,setWanted]=useState(readPreference);
 const[color,setColor]=useState(readColor);
 function chooseColor(next:ShineColor){setColor(next);rememberedColor=next;try{localStorage.setItem(colorKey,next);}catch{/* Color still works for this page when storage is unavailable. */}}

 const[tilt,setTilt]=useState(false),[requesting,setRequesting]=useState(false),[notice,setNotice]=useState('');
 const supported=window.isSecureContext&&typeof window.DeviceOrientationEvent!=='undefined';
 function paint(angle:number){
  pending.current=angle;
  if(frame.current)return;
  frame.current=requestAnimationFrame(()=>{frame.current=0;root.current?.style.setProperty('--card-edge-angle',`${pending.current}deg`);});
 }
 useEffect(()=>{
  alive.current=true;
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const change=()=>{setReduced(media.matches);if(media.matches){setTilt(false);setNotice('');cancelAnimationFrame(frame.current);frame.current=0;root.current?.style.removeProperty('--card-edge-angle');}};
  media.addEventListener('change',change);
  return()=>{alive.current=false;cancelAnimationFrame(frame.current);frame.current=0;media.removeEventListener('change',change);};
 },[]);
 // The saved appearance choice is separate from the browser's actual sensor permission.
 useEffect(()=>{
  if(!wanted||reduced||!supported){setTilt(false);return;}
  let current=true;
  if(pagePermissionGranted){setTilt(true);return;}
  const access=window.DeviceOrientationEvent as OrientationAccess;
  Promise.resolve().then(()=>access.requestPermission?access.requestPermission():'granted').then(permission=>{
   if(!current)return;
   if(permission==='granted'){pagePermissionGranted=true;setTilt(true);}
   else{setTilt(false);setNotice('Tap Enable tilt shine to resume. Your browser requires motion permission.');}
  }).catch(()=>{if(current){setTilt(false);setNotice('Tap Enable tilt shine to resume. Your browser requires motion permission.');}});
  return()=>{current=false;};
 },[wanted,reduced,supported]);
 useEffect(()=>{
  if(!tilt||reduced)return;
  baseline.current=null;
  function orientation(e:DeviceOrientationEvent){
   if(document.hidden||!Number.isFinite(e.gamma)||!Number.isFinite(e.beta)||e.gamma===null||e.beta===null)return;
   baseline.current??={gamma:e.gamma,beta:e.beta};
   paint(135+clamp((e.gamma-baseline.current.gamma)/25)*120+clamp((e.beta-baseline.current.beta)/35)*35);
  }
  const reset=()=>{baseline.current=null;};
  window.addEventListener('deviceorientation',orientation,{passive:true});
  document.addEventListener('visibilitychange',reset);
  window.addEventListener('orientationchange',reset);
  return()=>{window.removeEventListener('deviceorientation',orientation);document.removeEventListener('visibilitychange',reset);window.removeEventListener('orientationchange',reset);cancelAnimationFrame(frame.current);frame.current=0;};
 },[tilt,reduced]);
 async function toggleTilt(){
  if(tilt){savePreference(false);setWanted(false);setTilt(false);setNotice('');return;}
  if(reduced||!supported||requesting)return;
  setRequesting(true);setNotice('');
  try{
   const access=window.DeviceOrientationEvent as OrientationAccess;
   const permission=access.requestPermission?await access.requestPermission():'granted';
   if(!alive.current)return;
   if(permission==='granted'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){pagePermissionGranted=true;savePreference(true);setWanted(true);setTilt(true);setNotice('Tilt shine stays on for this device. Move your phone gently.');}
   else setNotice('Tilt access was not enabled. Touch still moves the edge highlight.');
  }catch{if(alive.current)setNotice('Tilt access was not enabled. Touch still moves the edge highlight.');}
  finally{if(alive.current)setRequesting(false);}
 }
 function onPointerMove(e:PointerEvent<HTMLDivElement>){
  if(reduced||tilt)return;
  const card=(e.target as Element).closest('.motion-edge-card');if(!card)return;
  const r=card.getBoundingClientRect();
  paint(135+clamp((e.clientX-r.left)/r.width*2-1)*120+clamp((e.clientY-r.top)/r.height*2-1)*35);
 }
 return{root,reduced,tilt,supported,requesting,notice,toggleTilt,onPointerMove,color,chooseColor};
}
