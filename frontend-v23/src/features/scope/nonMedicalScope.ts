/**
 * Alcance no médico de ETNARA Care (decisión del 14-nov-2026).
 *
 * ETNARA administra servicios de cuidado NO médico. No ofrece ni administra diagnósticos,
 * tratamientos, medicamentos, evaluaciones clínicas ni expedientes médicos.
 *
 * Reglas de este archivo (solo portal):
 * - Nada se borra: los datos y registros históricos se conservan y se siguen mostrando.
 * - Lo que se deja de ofrecer solo desaparece de las opciones para registros NUEVOS.
 * - Los campos de texto libre avisan qué no escribir.
 * Si ETNARA está o no sujeta a HIPAA es una determinación jurídica pendiente: aquí no se afirma nada.
 */
import { taskCategoryLabels, type CarePlanTaskCategory } from "@/api/carePlans";

/** Aviso corto para cualquier campo de texto libre sobre la persona atendida. */
export const NON_MEDICAL_TEXT_HINT = "Solo cuidado cotidiano. No escribas diagnósticos, medicamentos ni tratamientos.";

/** Campo de alergias: se conserva por seguridad al preparar comidas y en la rutina diaria. */
export const ALLERGIES_LABEL = "Alergias y restricciones alimentarias";
export const ALLERGIES_HINT = "Lo necesario para preparar comidas y la rutina con seguridad. Separa con comas. Sin diagnósticos ni medicamentos.";

/** Categorías que ya no se ofrecen para tareas nuevas (las existentes se conservan). */
export const RETIRED_TASK_CATEGORIES: readonly CarePlanTaskCategory[] = ["MEDICATION_REMINDER"];

/**
 * Opciones de categoría para una tarea del plan. Una categoría retirada solo aparece si la
 * tarea ya la tenía, para que editar un plan antiguo no cambie ni pierda ese dato.
 */
export function selectableTaskCategories(current?: CarePlanTaskCategory): Array<[CarePlanTaskCategory, string]> {
  return (Object.entries(taskCategoryLabels) as Array<[CarePlanTaskCategory, string]>)
    .filter(([value]) => !RETIRED_TASK_CATEGORIES.includes(value) || value === current);
}
