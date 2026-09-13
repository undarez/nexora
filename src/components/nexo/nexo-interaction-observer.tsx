"use client";
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getNexoraPageContext } from '@/lib/lia/copilot-context';

type EventType = 'page_focus'|'page_leave'|'view_entity'|'search'|'open_transaction'|'open_budget'|'edit_budget'|'create_item'|'delete_item'|'change_forecast'|'view_indicator'|'submit_action'|'repeat_view'|'hesitation';
const KEY='nexora:copilot-session';
function sessionId(){const old=window.sessionStorage.getItem(KEY);if(old&&/^[A-Za-z0-9_-]{16,80}$/.test(old))return old;const id=`nx_${crypto.randomUUID().replaceAll('-','')}`;window.sessionStorage.setItem(KEY,id);return id;}
function send(eventType:EventType,path:string,el?:HTMLElement){
 const feature=el?.getAttribute('data-nexora-feature')||undefined;
 const target=el?.getAttribute('data-nexora-target')||undefined;
 const source=el?.getAttribute('data-nexora-source')||undefined;
 void fetch('/api/lia/interaction',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventType,path,sessionId:sessionId(),featureKey:feature,targetKey:target,metadata:source?{source}:undefined}),keepalive:true}).catch(()=>{});
}
export function NexoInteractionObserver(){
 const pathname=usePathname();
 useEffect(()=>{
  if(!pathname)return; const ctx=getNexoraPageContext(pathname);
  const onFocus=()=>send('page_focus',ctx.path);
  const onClick=(ev:MouseEvent)=>{const node=(ev.target as Element|null)?.closest?.('[data-nexora-event]') as HTMLElement|null;if(!node)return;const type=node.getAttribute('data-nexora-event') as EventType|null;if(type)send(type,ctx.path,node);};
  window.addEventListener('focus',onFocus); document.addEventListener('click',onClick,true); send('page_focus',ctx.path);
  return()=>{window.removeEventListener('focus',onFocus);document.removeEventListener('click',onClick,true);send('page_leave',ctx.path);};
 },[pathname]);
 return null;
}
