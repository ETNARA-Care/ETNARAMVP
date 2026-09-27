import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, ChevronRight, FileCheck2, Mail, MapPin, ShieldAlert, UserRound, Users } from "lucide-react";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getEstablishmentWorkspace, type EstablishmentWorkspace } from "@/api/establishments";

type Section = "overview" | "residents" | "personnel";

export function EstablishmentAdminPage() {
  const { establishmentId = "" } = useParams();
  const { activeOrganization } = useAuth();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<EstablishmentWorkspace | null>(null);
  const [error, setError] = useState(false);
  const [section, setSection] = useState<Section>("overview");
  const [selectedResident, setSelectedResident] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

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

  const resident = workspace.residents.find((item) => item.id === selectedResident);
  const person = workspace.personnel.find((item) => item.membership_id === selectedPerson);
  const backToOverview = () => { setSection("overview"); setSelectedResident(null); setSelectedPerson(null); };

  if (resident) return <div className="flex flex-col gap-6">
    <button className="flex items-center gap-2 text-sm font-medium" onClick={() => setSelectedResident(null)}><ArrowLeft size={17}/>Volver a residentes</button>
    <PageHeader title={`${resident.first_name} ${resident.last_name}`} description="Expediente del residente" />
    <Card className="flex flex-col gap-3">
      <div><p className="text-sm text-[var(--color-text-muted)]">Estado</p><p className="font-semibold">{resident.status === "active" ? "Activo" : resident.status}</p></div>
      {resident.preferred_name && <div><p className="text-sm text-[var(--color-text-muted)]">Nombre preferido</p><p>{resident.preferred_name}</p></div>}
      <div><p className="text-sm text-[var(--color-text-muted)]">Habitación</p><p>{resident.room_id || "Sin habitación asignada"}</p></div>
    </Card>
    <Card><p className="font-semibold">Documentos y expediente</p><p className="mt-1 text-sm text-[var(--color-text-muted)]">Este residente pertenece a {workspace.establishment.name}. Los documentos clínicos y de admisión se conectarán aquí en el módulo de Compliance.</p></Card>
  </div>;

  if (person) return <div className="flex flex-col gap-6">
    <button className="flex items-center gap-2 text-sm font-medium" onClick={() => setSelectedPerson(null)}><ArrowLeft size={17}/>Volver a personal</button>
    <PageHeader title={person.display_name || "Personal"} description={person.role || "Personal del establecimiento"} />
    <Card className="flex flex-col gap-3">
      <div><p className="text-sm text-[var(--color-text-muted)]">Estado</p><p className="font-semibold">{person.status === "active" ? "Activo" : person.status}</p></div>
      {person.email && <div className="flex items-center gap-2"><Mail size={17}/><span>{person.email}</span></div>}
      <div className="flex items-center gap-2"><MapPin size={17}/><span>{workspace.establishment.name}</span></div>
    </Card>
    <Card><p className="font-semibold">Credenciales y elegibilidad</p><p className="mt-1 text-sm text-[var(--color-text-muted)]">Las credenciales, vencimientos y autorización para trabajar se integrarán aquí con Compliance.</p></Card>
  </div>;

  if (section === "residents") return <div className="flex flex-col gap-6">
    <button className="flex items-center gap-2 text-sm font-medium" onClick={backToOverview}><ArrowLeft size={17}/>Volver al panel</button>
    <PageHeader title="Residentes" description={`${workspace.establishment.name} · ${workspace.residents.length} asignado${workspace.residents.length === 1 ? "" : "s"}`} />
    {workspace.residents.length === 0 ? <EmptyState title="No hay residentes asignados"/> : <div className="flex flex-col gap-3">{workspace.residents.map((item) => <button key={item.id} className="text-left" onClick={() => setSelectedResident(item.id)}><Card className="flex items-center gap-3"><UserRound size={22}/><div className="flex-1"><p className="font-semibold">{item.first_name} {item.last_name}</p><p className="text-sm text-[var(--color-text-muted)]">{item.status === "active" ? "Activo" : item.status}</p></div><ChevronRight size={20}/></Card></button>)}</div>}
  </div>;

  if (section === "personnel") return <div className="flex flex-col gap-6">
    <button className="flex items-center gap-2 text-sm font-medium" onClick={backToOverview}><ArrowLeft size={17}/>Volver al panel</button>
    <PageHeader title="Personal" description={`${workspace.establishment.name} · ${workspace.personnel.length} asignado${workspace.personnel.length === 1 ? "" : "s"}`} />
    {workspace.personnel.length === 0 ? <EmptyState title="No hay personal asignado"/> : <div className="flex flex-col gap-3">{workspace.personnel.map((item) => <button key={item.membership_id} className="text-left" onClick={() => setSelectedPerson(item.membership_id)}><Card className="flex items-center gap-3"><Users size={22}/><div className="flex-1"><p className="font-semibold">{item.display_name || "Personal"}</p><p className="text-sm text-[var(--color-text-muted)]">{item.role || (item.status === "active" ? "Activo" : item.status)}</p></div><ChevronRight size={20}/></Card></button>)}</div>}
  </div>;

  const modules = [
    { label:"Residentes", detail:`${workspace.residents.length} asignado${workspace.residents.length === 1 ? "" : "s"}`, icon:<UserRound size={22}/>, action:() => setSection("residents"), enabled:true },
    { label:"Personal", detail:`${workspace.personnel.length} asignado${workspace.personnel.length === 1 ? "" : "s"}`, icon:<Users size={22}/>, action:() => setSection("personnel"), enabled:true },
    { label:"Turnos", detail:"Programación del establecimiento", icon:<CalendarClock size={22}/>, enabled:false },
    { label:"Documentos / Compliance", detail:"Credenciales y requisitos", icon:<FileCheck2 size={22}/>, enabled:false },
    { label:"Incidentes", detail:"Seguimiento del establecimiento", icon:<ShieldAlert size={22}/>, enabled:false },
  ];

  return <div className="flex flex-col gap-6">
    <button className="flex items-center gap-2 text-sm font-medium" onClick={() => navigate("/caregiver/shifts")}><ArrowLeft size={17}/>Volver a mi portal</button>
    <PageHeader title={workspace.establishment.name} description={`Panel de administración · ${workspace.establishment.address || "Dirección no registrada"}`} />
    <div className="grid gap-3">{modules.map((module) => module.enabled ? <button key={module.label} className="text-left" onClick={module.action}><Card className="flex items-center gap-4"><div>{module.icon}</div><div className="flex-1"><p className="font-semibold">{module.label}</p><p className="text-sm text-[var(--color-text-muted)]">{module.detail}</p></div><ChevronRight size={20}/></Card></button> : <Card key={module.label} className="flex items-center gap-4"><div>{module.icon}</div><div className="flex-1"><p className="font-semibold">{module.label}</p><p className="text-sm text-[var(--color-text-muted)]">{module.detail}</p></div><span className="text-xs text-[var(--color-text-muted)]">Próximamente</span></Card>)}</div>
  </div>;
}
