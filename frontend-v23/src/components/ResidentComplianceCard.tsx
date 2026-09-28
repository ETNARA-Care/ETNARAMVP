import { AlertTriangle,CheckCircle2,Clock3,ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { calculateResidentCompliance,complianceLabels } from "@/features/residentCompliance";
import type { ResidentDocument } from "@/api/residentDocuments";

export function ResidentComplianceCard({documents}:{documents:ResidentDocument[]}){
  const c=calculateResidentCompliance(documents);
  const Icon=c.state==="complete"?CheckCircle2:c.state==="expiring"?Clock3:c.state==="expired"?AlertTriangle:ShieldCheck;
  return <Card className="flex flex-col gap-4">
    <div className="flex items-start justify-between gap-3"><div className="flex gap-2"><Icon/><div><b>Compliance del expediente</b><p className="text-sm">{complianceLabels[c.state]}</p></div></div><b>{c.completed}/{c.total}</b></div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[#17294d]" style={{width:`${c.percentage}%`}}/></div>
    <p className="text-sm">{c.percentage}% de requisitos documentales completados</p>
    {c.missing.length>0&&<div><b className="text-sm">Pendientes</b><ul className="mt-1 list-disc pl-5 text-sm">{c.missing.map(x=><li key={x}>{x}</li>)}</ul></div>}
    {c.expired.length>0&&<div><b className="text-sm">Vencidos</b><ul className="mt-1 list-disc pl-5 text-sm">{c.expired.map(x=><li key={x.id}>{x.title} · {x.expires_on}</li>)}</ul></div>}
    {c.expiring.length>0&&<div><b className="text-sm">Vencen en los próximos 30 días</b><ul className="mt-1 list-disc pl-5 text-sm">{c.expiring.map(x=><li key={x.id}>{x.title} · {x.expires_on}</li>)}</ul></div>}
  </Card>;
}
