import type { DemoCareEvent, DemoResident } from "./types";

const mealLabel: Record<NonNullable<DemoCareEvent["mealSubtype"]>, string> = {
  breakfast: "desayunó",
  lunch: "almorzó",
  dinner: "cenó",
};

const moodLabel: Record<NonNullable<DemoCareEvent["mood"]>, string> = {
  calm: "estuvo tranquila",
  happy: "estuvo de muy buen ánimo",
  agitated: "estuvo un poco inquieta",
  sad: "estuvo algo decaída",
};

/**
 * Convierte un evento operacional (lo que escribe el cuidador) en la
 * versión que ve la familia -- nunca términos clínicos ni porcentajes.
 * Ejemplo del brief: "Meal · breakfast · 75%" -> "Carmen desayunó bien
 * esta mañana." Un incidente se menciona sin detalle clínico -- el
 * detalle completo solo lo ve Agencia.
 */
export function humanizeForFamily(event: DemoCareEvent, resident: DemoResident): string {
  const name = resident.name.split(" ")[0];
  switch (event.type) {
    case "check_in":
      return `El equipo de cuidado llegó para el turno de ${name}.`;
    case "check_out":
      return `El turno de ${name} de hoy ha finalizado.`;
    case "meal": {
      const verb = event.mealSubtype ? mealLabel[event.mealSubtype] : "comió";
      const qualifier = (event.mealPercent ?? 0) >= 60 ? "bien" : "poco";
      return `${name} ${verb} ${qualifier}${event.mealSubtype === "breakfast" ? " esta mañana" : ""}.`;
    }
    case "water":
      return `${name} se mantuvo bien hidratada.`;
    case "mobility":
      return `${name} caminó un poco y se movió con ayuda.`;
    case "mood":
      return `${name} ${event.mood ? moodLabel[event.mood] : "estuvo bien"}.`;
    case "observation":
      return `El equipo de cuidado dejó una nota sobre ${name}.`;
    case "incident":
      return `Se reportó una situación durante el turno de ${name}. El equipo de administración ya fue notificado.`;
    default:
      return "";
  }
}
