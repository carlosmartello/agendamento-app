// Regras de horário comercial e utilitários compartilhados client/server.
// Centralizar aqui evita divergência entre validação do formulário e do backend.

export const BUSINESS_HOURS = {
  // 0 = domingo, 6 = sábado. Aberto de segunda a sábado.
  openDays: [1, 2, 3, 4, 5, 6],
  startHour: 9,
  endHour: 18,
  slotMinutes: 30,
} as const;

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled";

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

/** Gera todos os slots (ISO local) para uma data. */
export function generateDaySlots(date: Date): Date[] {
  const slots: Date[] = [];
  const { startHour, endHour, slotMinutes } = BUSINESS_HOURS;
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += slotMinutes) {
      const d = new Date(date);
      d.setHours(h, m, 0, 0);
      slots.push(d);
    }
  }
  return slots;
}

export function isBusinessDay(date: Date): boolean {
  return (BUSINESS_HOURS.openDays as readonly number[]).includes(date.getDay());
}

export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateLong(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}