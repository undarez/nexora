"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
const routes=["/dashboard","/transactions","/budget","/banque","/patrimoine","/previsions","/pilotage"];
export function AndroidInteractionLayer(){
 const pathname=usePathname(); const router=useRouter(); const [open,setOpen]=useState(false);
 useEffect(()=>{let sx=0,sy=0,active=false; const start=(e:TouchEvent)=>{if(e.touches.length!==1)return;const t=e.target as HTMLElement|null;if(t?.closest("input,textarea,select,button,a,[role=dialog],.overflow-x-auto,table"))return;sx=e.touches[0].clientX;sy=e.touches[0].clientY;active=true}; const end=(e:TouchEvent)=>{if(!active||e.changedTouches.length!==1)return;active=false;const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)<90||Math.abs(dx)<Math.abs(dy)*1.35)return;const i=routes.indexOf(pathname);if(i<0)return;const n=routes[i+(dx<0?1:-1)];if(n)router.push(n)};window.addEventListener("touchstart",start,{passive:true});window.addEventListener("touchend",end,{passive:true});return()=>{window.removeEventListener("touchstart",start);window.removeEventListener("touchend",end)}},[pathname,router]);
 return <div className="android-quick-actions"><div className={open?"android-quick-menu":"android-quick-menu hidden"} role="menu"><Link href="/transactions?quick=expense" onClick={()=>setOpen(false)}>− Dépense</Link><Link href="/transactions?quick=income" onClick={()=>setOpen(false)}>＋ Revenu</Link><Link href="/budget" onClick={()=>setOpen(false)}>◈ Budget</Link></div><button type="button" className="android-fab" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label="Actions rapides"><span aria-hidden>{open?"×":"+"}</span></button></div>;
}
