import { useState } from "react";

export interface TowerFloor { id: string; name: string; agents: number }

/** Interactive architectural perspective; no autonomous actions. */
export function TowerBuilding({ floors, onSelect }: { floors: TowerFloor[]; onSelect: (id: string) => void }) {
  const [active, setActive] = useState<string | null>(null);
  const [side, setSide] = useState(false);
  return <section aria-label="Edificio ETNARA Tower" className="rounded-2xl bg-[#0c2033] p-5 text-white md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-xs uppercase tracking-widest text-[#b5d3c7]">Sede corporativa digital</p><h2 className="mt-2 font-display text-3xl">La Torre ETNARA</h2><p className="mt-2 text-sm text-white/70">Explora los ocho pisos y selecciona un departamento.</p></div>
      <button type="button" onClick={() => setSide(value => !value)} className="min-h-11 rounded-lg border border-white/30 px-4 text-sm">Girar torre</button>
    </div>
    <div className="mt-8 grid gap-8 lg:grid-cols-2">
      <div className="flex min-h-[460px] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-[#264b5b] to-[#081523]" style={{ perspective: "900px" }}>
        <div className="w-[76%] max-w-[300px] transition-transform duration-700 motion-reduce:transition-none" style={{ transform: side ? "rotateY(-17deg) rotateX(4deg)" : "rotateY(17deg) rotateX(4deg)" }}>
          <div className="rounded-t-xl border-2 border-[#b7d3d0]/60 bg-[#17364b] py-5 text-center font-display text-2xl tracking-[0.2em]">ETNARA</div>
          {[...floors].reverse().map((floor, i) => <button type="button" key={floor.id} aria-pressed={active === floor.id} onClick={() => { setActive(floor.id); onSelect(floor.id); }} className={`flex min-h-12 w-full items-center justify-between gap-2 border-x-2 border-b border-[#a9d0ce]/50 px-3 text-left text-xs hover:bg-[#527e79] ${active === floor.id ? "bg-[#527e79]" : "bg-gradient-to-r from-[#204258] via-[#356b7c] to-[#16364d]"}`}><span>{floors.length - i}</span><span className="truncate">{floor.name}</span><span>{floor.agents}</span></button>)}
          <div className="rounded-b-lg border-2 border-[#b7d3d0]/60 bg-[#17364b] py-3 text-center text-xs tracking-widest">ENTRADA</div>
        </div>
      </div>
      <div className="space-y-3"><h3 className="font-display text-xl">Directorio de pisos</h3>{floors.map((floor, i) => <button key={floor.id} type="button" aria-pressed={active === floor.id} onClick={() => { setActive(floor.id); onSelect(floor.id); }} className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-4 py-2 text-left text-sm ${active === floor.id ? "border-[#b5d3c7] bg-[#527e79]" : "border-white/20 bg-white/5 hover:bg-white/10"}`}><span>{i + 1}. {floor.name}</span><span className="text-xs text-white/70">{floor.agents} agentes</span></button>)}<p className="text-xs text-white/60">Representación arquitectónica interactiva. Los agentes aún no ejecutan tareas autónomas.</p></div>
    </div>
  </section>;
}
