import { useState } from "react";
import type { TowerFloor } from "./floors";

interface Props { floors: readonly TowerFloor[]; onSelect: (departmentId: string) => void }
/** Accessible premium architectural fallback. Future WebGL scene shares this exact floor contract. */
export function TowerPremiumFacade({ floors, onSelect }: Props) {
  const [active, setActive] = useState<number | null>(null);
  return <section aria-label="ETNARA Tower: fachada arquitectónica interactiva" className="overflow-hidden rounded-2xl bg-[#0b1626] p-5 text-[#ece8de] md:p-8">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs uppercase tracking-[0.2em] text-[#9db89e]">Sede corporativa virtual</p><h2 className="mt-2 font-display text-3xl">La Torre Salvia</h2><p className="mt-2 max-w-xl text-sm text-[#9da9bb]">Ocho departamentos · {floors.reduce((sum, floor) => sum + floor.agents.length, 0)} puestos virtuales. Selecciona un piso para explorar su equipo.</p></div>
      <span className="rounded-full border border-[#c9ae7c]/40 px-3 py-2 text-xs text-[#e2a74c]">Agentes en preparación</span>
    </div>
    <div className="grid items-center gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)]">
      <div className="relative flex min-h-[500px] items-end justify-center overflow-hidden rounded-xl bg-gradient-to-b from-[#172d48] via-[#0c1b30] to-[#070f1b] pb-8">
        <div aria-hidden="true" className="absolute bottom-3 left-1/2 h-6 w-4/5 -translate-x-1/2 rounded-[50%] bg-[#9db89e]/10 blur-xl" />
        <div className="relative w-[min(78%,300px)] drop-shadow-2xl">
          <div className="rounded-t-2xl border-x border-t border-[#c9ae7c]/70 bg-[#17273d] py-5 text-center"><span className="font-display text-2xl tracking-[0.23em] text-[#efe9dc]">ETNARA</span><p className="mt-1 text-[10px] tracking-[0.3em] text-[#c9ae7c]">TOWER</p></div>
          {[...floors].reverse().map(floor => <button type="button" key={floor.departmentId} aria-pressed={active === floor.number} aria-label={`Piso ${floor.number}: ${floor.name}, ${floor.agents.length} agentes`} onClick={() => { setActive(floor.number); onSelect(floor.departmentId); }} className={`group relative flex min-h-[45px] w-full items-center justify-between gap-2 border-x border-b border-[#9db89e]/50 px-4 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${active === floor.number ? "bg-[#5f7e63] text-white" : "bg-gradient-to-r from-[#152b43] via-[#34536b] to-[#162c45] hover:bg-[#5f7e63]"}`}><span className="font-mono text-[#c9ae7c]">{String(floor.number).padStart(2,"0")}</span><span className="truncate">{floor.name}</span><span className="text-[#b9cfc5]">{floor.agents.length}</span></button>)}
          <div className="border-x border-b border-[#c9ae7c]/60 bg-[#d9d1c1] px-4 py-3 text-center text-xs font-semibold tracking-widest text-[#14213a]">ETNARA CARE · VESTÍBULO</div>
        </div>
      </div>
      <div><h3 className="mb-3 font-display text-xl">Directorio corporativo</h3><div className="space-y-2">{[...floors].reverse().map(floor => <button key={floor.departmentId} type="button" aria-pressed={active === floor.number} onClick={() => { setActive(floor.number); onSelect(floor.departmentId); }} className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-4 py-2 text-left text-sm ${active === floor.number ? "border-[#9db89e] bg-[#254339]" : "border-white/15 bg-white/5 hover:bg-white/10"}`}><span><span className="mr-3 font-mono text-xs text-[#9db89e]">{String(floor.number).padStart(2,"0")}</span>{floor.name}</span><span className="text-xs text-[#9da9bb]">{floor.agents.length}</span></button>)}</div><p className="mt-4 text-xs text-[#9da9bb]">Vista arquitectónica 2D accesible. La escena WebGL y las oficinas interiores se integrarán en una fase posterior; ninguna acción autónoma está habilitada.</p></div>
    </div>
  </section>;
}
