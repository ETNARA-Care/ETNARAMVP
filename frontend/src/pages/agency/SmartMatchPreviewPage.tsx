import { useState } from "react";
import { puertoRicoMunicipalities } from "../../data/puertoRicoMunicipalities";



const samples = [
  { id: 1, role: "Cuidador/a para turno diurno", zone: "Carolina, PR", time: "7:00 a. m. – 3:00 p. m.", status: "Publicada" },
  { id: 2, role: "Asistente de cuidado", zone: "Trujillo Alto, PR", time: "3:00 p. m. – 11:00 p. m.", status: "Borrador" },
];

export function SmartMatchPreviewPage() {
  const [view, setView] = useState<"agency" | "caregiver">("agency");
  const [zone, setZone] = useState("Carolina");
  const [minutes, setMinutes] = useState(25);
  const surface = { background: "#fff", border: "1px solid #e1e7e4", borderRadius: 16, padding: 20 };
  return (
    <main style={{ minHeight: "100dvh", background: "#f5f5ef", color: "#183044", fontFamily: "system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ fontSize: 23, letterSpacing: 2 }}>ETNARA <span style={{ color: "#6c8a7d" }}>Care</span></strong>
          <span style={{ background: "#e8eee8", padding: "8px 12px", borderRadius: 99, fontSize: 12 }}>VISTA PREVIA · DATOS FICTICIOS</span>
        </div>
        <h1 style={{ fontSize: "clamp(30px, 5vw, 46px)", marginBottom: 8 }}>SmartMatch</h1>
        <p style={{ color: "#546a70", maxWidth: 650 }}>Oportunidades de cuidado, con privacidad y control de la agencia. Esta pantalla es una demostración visual: no guarda información ni publica turnos reales.</p>
        <div style={{ display: "flex", gap: 10, margin: "24px 0" }}>
          <button onClick={() => setView("agency")} aria-pressed={view === "agency"} style={{ padding: "12px 18px", borderRadius: 10, border: 0, background: view === "agency" ? "#183044" : "#e3e9e5", color: view === "agency" ? "white" : "#183044" }}>Vista de agencia</button>
          <button onClick={() => setView("caregiver")} aria-pressed={view === "caregiver"} style={{ padding: "12px 18px", borderRadius: 10, border: 0, background: view === "caregiver" ? "#183044" : "#e3e9e5", color: view === "caregiver" ? "white" : "#183044" }}>Vista de cuidador</button>
        </div>
        {view === "agency" ? (
          <section style={{ display: "grid", gap: 16 }}>
            <div style={surface}>
              <h2 style={{ marginTop: 0 }}>Oportunidades de mi agencia</h2>
              <p style={{ color: "#647477" }}>Publica turnos para tus cuidadores. La red entre agencias permanece desactivada.</p>
              {samples.map(s => <div key={s.id} style={{ padding: "16px 0", borderTop: "1px solid #e8ece9" }}><strong>{s.role}</strong><div style={{ marginTop: 5 }}>{s.zone} · {s.time}</div><small>{s.status} · Solicitudes: 0 (ejemplo)</small></div>)}
            </div>
            <div style={surface}><h2 style={{ marginTop: 0 }}>Nueva oportunidad</h2><p>Municipio o zona general · Función requerida · Fecha y horario</p><p style={{ color: "#647477" }}>Sin nombre de paciente ni dirección exacta. La publicación real requerirá autenticación.</p></div>
          </section>
        ) : (
          <section style={{ display: "grid", gap: 16 }}>
            <div style={surface}>
              <h2 style={{ marginTop: 0 }}>Mis preferencias de búsqueda</h2>
              <label style={{ display: "grid", gap: 6, maxWidth: 340 }}>Zona habitual
                <select value={zone} onChange={e => setZone(e.target.value)} style={{ padding: 12, borderRadius: 8, border: "1px solid #bbc9c1" }}>{puertoRicoMunicipalities.map(town => <option key={town} value={town}>{town}</option>)}</select>
              </label>
              <label style={{ display: "grid", gap: 8, marginTop: 18, maxWidth: 340 }}>Tiempo máximo de viaje: <strong>{minutes} minutos</strong>
                <input type="range" min={10} max={60} step={5} value={minutes} onChange={e => setMinutes(Number(e.target.value))} />
              </label>
              <p style={{ color: "#647477" }}>Ubicación manual. GPS opcional solo con consentimiento. No se realiza seguimiento continuo.</p>
            </div>
            <div style={surface}><h2 style={{ marginTop: 0 }}>Oportunidades cercanas</h2><p>Los resultados reales dependerán de las credenciales, disponibilidad, membresía y tiempos de ruta verificados.</p><p><strong>Ejemplo:</strong> Cuidador/a para turno diurno · {zone}</p><small>Esta vista no calcula rutas ni permite solicitar turnos todavía.</small></div>
          </section>
        )}
        <p style={{ marginTop: 26, fontSize: 13, color: "#647477" }}>Prototipo visual de SmartMatch para futura integración en ETNARA Care. Sin conexión a datos reales.</p>
      </div>
    </main>
  );
}
