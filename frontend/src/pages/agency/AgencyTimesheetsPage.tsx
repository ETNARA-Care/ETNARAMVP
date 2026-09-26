import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { FinancialRate, Timesheet, TimesheetSummary, listFinancialRates, listTimesheets, reviewTimesheet, saveFinancialRate } from "../../api/timesheets";

const money=(c:number|null)=>c==null?"—":new Intl.NumberFormat("es-PR",{style:"currency",currency:"USD"}).format(c/100);
const hours=(m:number)=>`${(m/60).toFixed(2)} h`;
const iso=(d:Date)=>d.toISOString().slice(0,10);

export function AgencyTimesheetsPage(){
 const {activeOrganization}=useAuth(); const org=activeOrganization?.id;
 const today=new Date(), start=new Date(today); start.setDate(today.getDate()-14);
 const [from,setFrom]=useState(iso(start)),[to,setTo]=useState(iso(today)),[status,setStatus]=useState("");
 const [rows,setRows]=useState<Timesheet[]>([]),[summary,setSummary]=useState<TimesheetSummary|null>(null),[rates,setRates]=useState<FinancialRate[]>([]);
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function load(){if(!org)return; setBusy(true);setError("");try{const [t,r]=await Promise.all([listTimesheets(org,from,to,status||undefined),listFinancialRates(org)]);setRows(t.timesheets);setSummary(t.summary);setRates(r)}catch(e){setError(e instanceof Error?e.message:"No se pudo cargar.")}finally{setBusy(false)}}
 useEffect(()=>{void load()},[org,from,to,status]);
 async function approve(t:Timesheet){if(!org)return; const raw=window.prompt("Minutos a aprobar",String(t.recorded_minutes));if(raw===null)return;const mins=Number(raw);let note: string|undefined;if(mins!==t.recorded_minutes){note=window.prompt("Explique el ajuste de horas")||undefined;if(!note)return;}try{await reviewTimesheet(org,t.id,"approved",mins,note);await load()}catch(e){setError(e instanceof Error?e.message:"No se pudo aprobar.")}}
 async function dispute(t:Timesheet){if(!org)return;const note=window.prompt("Motivo de la disputa");if(!note)return;try{await reviewTimesheet(org,t.id,"disputed",undefined,note);await load()}catch(e){setError(e instanceof Error?e.message:"No se pudo disputar.")}}
 async function editRate(r:FinancialRate){if(!org)return;const pay=window.prompt("Pago por hora (USD)",r.pay_rate_cents==null?"":String(r.pay_rate_cents/100));if(pay===null)return;const bill=window.prompt("Tarifa a facturar por hora (USD)",r.bill_rate_cents==null?"":String(r.bill_rate_cents/100));if(bill===null)return;const pc=Math.round(Number(pay)*100),bc=Math.round(Number(bill)*100);if(!Number.isFinite(pc)||!Number.isFinite(bc)||pc<0||bc<0){setError("Tarifas inválidas.");return}try{await saveFinancialRate(org,r.membership_id,pc,bc);await load()}catch(e){setError(e instanceof Error?e.message:"No se pudo guardar la tarifa.")}}
 return <main style={{maxWidth:1180,margin:"0 auto",padding:24,fontFamily:"var(--font-body)"}}>
  <h1 style={{fontFamily:"var(--font-display)",marginBottom:4}}>Horas y facturación</h1>
  <p style={{color:"var(--color-ink-soft)",marginTop:0}}>Revisa horas reales, prepara pago y facturación. ETNARA no mueve dinero ni ejecuta nómina.</p>
  <div style={{display:"flex",gap:10,flexWrap:"wrap",margin:"20px 0"}}><label>Desde <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta <input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><label>Estado <select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos</option><option value="pending">Pendiente</option><option value="approved">Aprobado</option><option value="disputed">Disputado</option></select></label></div>
  {error&&<p role="alert" style={{color:"crimson"}}>{error}</p>}
  {summary&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:24}}>{[["Horas registradas",hours(summary.recordedMinutes)],["Horas aprobadas",hours(summary.approvedMinutes)],["Pendientes",summary.pendingCount],["En disputa",summary.disputedCount],["Pago preparado",money(summary.approvedPayCents)],["Facturación preparada",money(summary.approvedBillCents)]].map(([a,b])=><div key={String(a)} style={{border:"1px solid var(--color-border)",borderRadius:12,padding:14,background:"var(--color-surface)"}}><small>{a}</small><div style={{fontSize:20,fontWeight:700}}>{b}</div></div>)}</div>}
  <h2>Hojas de tiempo</h2>{busy?<p>Cargando…</p>:rows.length===0?<p>No hay hojas de tiempo en este periodo.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th align="left">Cuidador</th><th align="left">Persona</th><th>Registrado</th><th>Estado</th><th>Pago</th><th>Facturación</th><th>Acción</th></tr></thead><tbody>{rows.map(t=><tr key={t.id} style={{borderTop:"1px solid var(--color-border)"}}><td>{t.worker_name||"Sin nombre"}<br/><small>{t.worker_role}</small></td><td>{t.recipient_name||"—"}</td><td align="center">{hours(t.recorded_minutes)}</td><td align="center">{t.status}</td><td align="center">{money(t.pay_amount_cents)}</td><td align="center">{money(t.bill_amount_cents)}</td><td align="center">{t.status==="approved"?"Cerrada":<><button onClick={()=>void approve(t)}>Aprobar</button> <button onClick={()=>void dispute(t)}>Disputar</button></>}</td></tr>)}</tbody></table></div>}
  <h2 style={{marginTop:32}}>Tarifas del equipo</h2><p style={{color:"var(--color-ink-soft)"}}>Solo Administración/Supervisión. Estas tarifas no se muestran al cuidador ni a Familia.</p>
  <div style={{display:"grid",gap:8}}>{rates.map(r=><div key={r.membership_id} style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",border:"1px solid var(--color-border)",borderRadius:10,padding:12}}><span><strong>{r.display_name||"Sin nombre"}</strong> · {r.internal_role}<br/><small>Pago {money(r.pay_rate_cents)}/h · Facturación {money(r.bill_rate_cents)}/h</small></span><button onClick={()=>void editRate(r)}>Editar tarifas</button></div>)}</div>
 </main>
}
