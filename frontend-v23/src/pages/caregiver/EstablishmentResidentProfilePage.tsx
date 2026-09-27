import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, HeartPulse, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getEstablishmentWorkspace, getManagedResident, updateManagedResident, type EstablishmentResident, type EstablishmentWorkspace } from "@/api/establishments";
import { Button, Card, ErrorState, Input, PageHeader, Select, Skeleton, Textarea, useToast } from "@/components/ui";

type ResidentStatus = "active" | "inactive" | "archived";
function recordText(value?:Record<string,unknown>){if(!value)return "";return Object.entries(value).map(([key,v])=>`${key}: ${String(v)}`).join("\n");}
function textRecord(value:string){const result:Record<string,unknown>={};for(const line of value.split("\n").map(v=>v.trim()).filter(Boolean)){const i=line.indexOf(":");if(i>0)result[line.slice(0,i).trim()]=line.slice(i+1).trim();else result[line]=true;}return result;}

export function EstablishmentResidentProfilePage() {
  const { establishmentId = "", residentId = "" } = useParams();
  const { activeOrganization } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [workspace,setWorkspace]=useState<EstablishmentWorkspace|null>(null);
  const [resident,setResident]=useState<EstablishmentResident|null>(null);
  const [error,setError]=useState(false);const [editing,setEditing]=useState(false);const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({firstName:"",lastName:"",preferredName:"",dateOfBirth:"",allergies:"",preferences:"",routines:"",status:"active" as ResidentStatus});

  const load=useCallback(async()=>{const token=getToken();if(!token||!activeOrganization?.id||!establishmentId)return;try{const [w,r]=await Promise.all([getEstablishmentWorkspace(activeOrganization.id,establishmentId,token),getManagedResident(activeOrganization.id,establishmentId,residentId,token)]);setWorkspace(w);setResident(r.resident);setError(false);}catch{setError(true);}},[activeOrganization?.id,establishmentId,residentId]);
  useEffect(()=>{void load();},[load]);
  if(error)return <ErrorState kind="server" onRetry={()=>void load()}/>;if(!workspace||!resident)return <Skeleton className="h-40"/>;

  const openEdit=()=>{setForm({firstName:resident.first_name??"",lastName:resident.last_name??"",preferredName:resident.preferred_name??"",dateOfBirth:resident.date_of_birth??"",allergies:resident.allergies?.join(", ")??"",preferences:recordText(resident.preferences),routines:recordText(resident.routines),status:(resident.status as ResidentStatus)||"active"});setEditing(true);};
  const save=async()=>{const token=getToken();if(!token||!activeOrganization?.id||!form.firstName.trim()||!form.lastName.trim())return;setSaving(true);try{const response=await updateManagedResident(activeOrganization.id,establishmentId,residentId,{firstName:form.firstName.trim(),lastName:form.lastName.trim(),preferredName:form.preferredName.trim()||null,dateOfBirth:form.dateOfBirth||null,allergies:form.allergies.split(",").map(v=>v.trim()).filter(Boolean),preferences:textRecord(form.preferences),routines:textRecord(form.routines),status:form.status},token);setResident(response.resident);setEditing(false);toast.show("Expediente del residente actualizado.","success");}catch{toast.show("No pudimos actualizar el expediente.","danger");}finally{setSaving(false);}};

  return <div className="flex flex-col gap-5">
    <button onClick={()=>navigate(`/caregiver/admin/establishments/${establishmentId}`)} className="flex items-center gap-2"><ArrowLeft size={17}/>Volver a {workspace.establishment.name}</button>
    <PageHeader title={`${resident.first_name} ${resident.last_name}`} description={`Expediente operacional · ${workspace.establishment.name}`} actions={!editing?<Button onClick={openEdit}>Editar expediente</Button>:undefined}/>
    {editing?<Card className="flex flex-col gap-3"><div className="flex items-center gap-2"><UserRound size={20}/><b>Editar expediente</b></div><Input label="Nombre" value={form.firstName} onChange={e=>setForm(v=>({...v,firstName:e.target.value}))}/><Input label="Apellidos" value={form.lastName} onChange={e=>setForm(v=>({...v,lastName:e.target.value}))}/><Input label="Nombre preferido" value={form.preferredName} onChange={e=>setForm(v=>({...v,preferredName:e.target.value}))}/><Input label="Fecha de nacimiento" type="date" value={form.dateOfBirth} onChange={e=>setForm(v=>({...v,dateOfBirth:e.target.value}))}/><Input label="Alergias (separadas por coma)" value={form.allergies} onChange={e=>setForm(v=>({...v,allergies:e.target.value}))}/><Textarea label="Preferencias (una por línea, ejemplo: comida: suave)" value={form.preferences} onChange={e=>setForm(v=>({...v,preferences:e.target.value}))}/><Textarea label="Rutinas (una por línea)" value={form.routines} onChange={e=>setForm(v=>({...v,routines:e.target.value}))}/><Select label="Estado" value={form.status} onChange={e=>setForm(v=>({...v,status:e.target.value as ResidentStatus}))}><option value="active">Activo</option><option value="inactive">Inactivo</option><option value="archived">Archivado</option></Select><div className="flex gap-2"><Button onClick={()=>void save()} disabled={saving}>{saving?"Guardando…":"Guardar cambios"}</Button><Button variant="secondary" onClick={()=>setEditing(false)}>Cancelar</Button></div></Card>:<>
      <div className="grid gap-3 md:grid-cols-2"><Card><div className="flex items-center gap-2 mb-3"><UserRound size={20}/><b>Información básica</b></div><p>Nombre legal: {resident.first_name} {resident.last_name}</p><p>Nombre preferido: {resident.preferred_name||"No registrado"}</p><p>Fecha de nacimiento: {resident.date_of_birth||"No registrada"}</p><p>Habitación: {resident.room_id||"No asignada"}</p><p>Estado: {resident.status}</p></Card><Card><div className="flex items-center gap-2 mb-3"><HeartPulse size={20}/><b>Información de cuidado</b></div><p>Alergias: {resident.allergies?.length?resident.allergies.join(", "):"No registradas"}</p><p className="mt-2"><b>Preferencias</b></p><pre className="whitespace-pre-wrap font-sans text-sm">{recordText(resident.preferences)||"No registradas"}</pre><p className="mt-2"><b>Rutinas</b></p><pre className="whitespace-pre-wrap font-sans text-sm">{recordText(resident.routines)||"No registradas"}</pre></Card></div>
      <Card><b>Plan individual de cuidado</b><p className="text-sm text-[var(--color-text-muted)] mt-2">El plan de cuidado, sus tareas y el historial operacional se incorporarán mediante servicios con alcance de este establecimiento. Los datos básicos y de cuidado ya se administran desde este expediente sin acceso a residentes de otros establecimientos.</p></Card>
    </>}
  </div>;
}
