import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, FileCheck2, ShieldAlert, UserRound, Users } from "lucide-react";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getEstablishmentWorkspace, type EstablishmentWorkspace } from "@/api/establishments";

export function EstablishmentAdminPage() {
  const { establishmentId = "" } = useParams();
  const { activeOrganization } = useAuth();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<EstablishmentWorkspace | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token || !activeOrganization?.id || !establishmentId) return;
    setError(false);
    try { setWorkspace(await getEstablishmentWorkspace(activeOrganization.id, establishmentId, token)); }
    catch { setError(true); }
  }, [activeOrganization?.id, establishmentId]);

  useEffect(() => { void load(); }, [load]);
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!workspace) return <div className="flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-36" /></div>;

  const modules = [
    { label:"Residentes", detail:`${workspace.residents.length} asignado${workspace.residents.length === 1 ? "" : "s"}`, icon:<UserRound size={22}/>, enabled:true },
    { label:"Personal", detail:`${workspace.personnel.length} asignado${workspace.personnel.length === 1 ? "" : "s"}`, icon:<Users size={22}/>, enabled:true },
    { label:"Turnos", detail:"Programación del establecimiento", icon:<CalendarClock size={22}/>, enabled:false },
    { label:"Documentos / Compliance", detail:"Credenciales y requisitos", icon:<FileCheck2 size={22}/>, enabled:false },
    { label:"Incidentes", detail:"Seguimiento del establecimiento", icon:<ShieldAlert size={22}/>, enabled:false },
  ];

  return <div className="flex flex-col gap-6">
    <button className="flex items-center gap-2 text-sm font-medium" onClick={() => navigate("/caregiver/shifts")}><ArrowLeft size={17}/>Volver a mi portal</button>
    <PageHeader title={workspace.establishment.name} description={`Panel de administración · ${workspace.establishment.address || "Dirección no registrada"}`} />
    <div className="grid gap-3">
      {modules.map((module) => <Card key={module.label} className="flex items-center gap-4">
        <div>{module.icon}</div><div className="flex-1"><p className="font-semibold">{module.label}</p><p className="text-sm text-[var(--color-text-muted)]">{module.detail}</p></div>
        {!module.enabled && <span className="text-xs text-[var(--color-text-muted)]">Próximamente</span>}
      </Card>)}
    </div>
    <section className="flex flex-col gap-3"><h2 className="font-display text-[var(--text-h3)]">Residentes</h2>{workspace.residents.length===0?<EmptyState title="No hay residentes asignados"/>:workspace.residents.map(r=><Card key={r.id}><p className="font-medium">{r.first_name} {r.last_name}</p></Card>)}</section>
    <section className="flex flex-col gap-3"><h2 className="font-display text-[var(--text-h3)]">Personal</h2>{workspace.personnel.length===0?<EmptyState title="No hay personal asignado"/>:workspace.personnel.map(p=><Card key={p.membership_id}><p className="font-medium">{p.display_name || "Personal"}</p></Card>)}</section>
  </div>;
}
