import { ScreenHeader, Card } from "../../components/Primitives";
import { demoFamilyMembers } from "../../demoData/timeline";
import { demoResidents } from "../../demoData/residents";

export function FamilyHistoryPage() {
  const days = [
    { label: "Hoy", detail: "8 actualizaciones · turno completado" },
    { label: "Ayer", detail: "7 actualizaciones · turno completado" },
    { label: "Lunes 11 de agosto", detail: "6 actualizaciones · turno completado" },
  ];
  return (
    <div>
      <ScreenHeader title="Historial" subtitle="Días anteriores de Carmen" />
      <div style={{ padding: "0 var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {days.map((d) => (
          <Card key={d.label}>
            <p style={{ margin: 0, fontWeight: 600 }}>{d.label}</p>
            <p style={{ margin: "4px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
              {d.detail}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function FamilyMessagesPage() {
  return (
    <div>
      <ScreenHeader title="Mensajes" subtitle="Con el equipo de Hogar Serenidad Demo" />
      <div style={{ padding: "0 var(--space-5)" }}>
        <Card style={{ background: "var(--color-warning-bg)", border: "none", marginBottom: "var(--space-4)" }}>
          <p style={{ margin: 0, fontSize: "var(--fs-caption)", color: "var(--color-warning)" }}>
            Para emergencias, llama directamente al (787) 555-0100.
          </p>
        </Card>
        <Card>
          <p style={{ margin: 0, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
            Aún no has enviado mensajes. Escribe aquí si tienes alguna pregunta para el equipo de cuidado. (Demo — sin envío real)
          </p>
        </Card>
      </div>
    </div>
  );
}

export function FamilyProfilePage() {
  const familyMember = demoFamilyMembers[0];
  const resident = demoResidents[0];
  return (
    <div>
      <ScreenHeader title="Perfil" />
      <div style={{ padding: "0 var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Card>
          <p style={{ margin: 0, fontWeight: 600 }}>{familyMember.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
            {familyMember.relationship} de {resident.name}
          </p>
        </Card>
        <Card>
          <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: "var(--fs-caption)" }}>Notificaciones</p>
          <p style={{ margin: 0, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
            {familyMember.canReceiveNotifications ? "Activadas" : "Desactivadas"}
          </p>
        </Card>
        <Card>
          <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: "var(--fs-caption)" }}>Fotografías</p>
          <p style={{ margin: 0, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
            {familyMember.canViewPhotos ? "Puedes ver fotos compartidas" : "No autorizado para ver fotos"}
          </p>
        </Card>
      </div>
    </div>
  );
}
