import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { addMinutes, getBusinessClose, intervalsOverlap } from "@/lib/booking-constants";

// Cliente publishable server-side para leituras públicas (sem sessão)
function serverPublic() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

// ---------- Público ----------

export const listServices = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = serverPublic();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, description, duration_min, price_cents")
    .eq("active", true)
    .order("price_cents", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

export const listBookedSlots = createServerFn({ method: "GET" })
  .inputValidator((d: { date: string }) => ({ date: dateSchema.parse(d.date) }))
  .handler(async ({ data }) => {
    const supabase = serverPublic();
    const { data: rows, error } = await supabase.rpc("get_booked_slots", {
      _date: data.date,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      scheduled_at: r.scheduled_at as string,
      duration_min: Number(r.duration_min ?? 30),
    }));
  });

const createSchema = z.object({
  client_name: z.string().trim().min(2, "Nome muito curto").max(100),
  client_phone: z.string().trim().min(10, "Telefone inválido").max(20),
  service_id: z.string().uuid("Serviço inválido"),
  service_ids: z.array(z.string().uuid()).min(1).max(20),
  scheduled_at: z.string().datetime({ offset: true }),
  notes: z.string().trim().max(500).optional(),
});

export const createAppointment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }) => {
    const supabase = serverPublic();

    // Valida horário comercial no servidor
    const when = new Date(data.scheduled_at);
    const day = when.getUTCDay(); // usamos UTC apenas para checar consistência
    const localDay = when.getDay();
    if (Number.isNaN(when.getTime())) {
      throw new Error("Data/horário inválidos");
    }
    if (when.getTime() < Date.now()) {
      throw new Error("Não é possível agendar no passado");
    }
    // Aceita se for dia útil pela data local do servidor
    if (localDay === 0 && day === 0) {
      throw new Error("Fechado aos domingos");
    }

    // Gera o id no servidor - evita depender de SELECT policy pra retornar o RETURNING
    const uniqueServiceIds = Array.from(new Set([data.service_id, ...data.service_ids]));
    const { data: selectedServices, error: serviceError } = await supabase
      .from("services")
      .select("id, duration_min")
      .in("id", uniqueServiceIds)
      .eq("active", true);
    if (serviceError) throw new Error(serviceError.message);
    if (!selectedServices || selectedServices.length !== uniqueServiceIds.length) {
      throw new Error("Um ou mais serviços são inválidos ou indisponíveis");
    }

    const totalDuration = selectedServices.reduce((sum, service) => sum + service.duration_min, 0);
    const end = addMinutes(when, totalDuration);
    if (end > getBusinessClose(when)) {
      throw new Error("Estes serviços não cabem no horário de funcionamento.");
    }

    const date = [
      when.getFullYear(),
      String(when.getMonth() + 1).padStart(2, "0"),
      String(when.getDate()).padStart(2, "0"),
    ].join("-");
    const { data: booked, error: bookedError } = await supabase.rpc("get_booked_slots", {
      _date: date,
    });
    if (bookedError) throw new Error(bookedError.message);

    const hasConflict = (booked ?? []).some((slot) => {
      const bookedStart = new Date(slot.scheduled_at as string);
      const bookedEnd = addMinutes(bookedStart, Number(slot.duration_min ?? 30));
      return intervalsOverlap(when, end, bookedStart, bookedEnd);
    });
    if (hasConflict) {
      throw new Error("Este horário conflita com outro agendamento.");
    }

    const { data: id, error } = await supabase.rpc("create_public_appointment", {
      _client_name: data.client_name,
      _client_phone: data.client_phone,
      _service_id: data.service_id,
      _service_ids: data.service_ids,
      _scheduled_at: data.scheduled_at,
      _notes: data.notes ?? null,
    });

    if (error) {
      // Índice único = conflito de horário
      if (error.code === "23505") {
        throw new Error("Este horário acabou de ser reservado. Escolha outro.");
      }
      throw new Error(error.message);
    }
    return { id: id as string };
  });

export const getConfirmation = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => ({
    id: z.string().uuid().parse(d.id),
  }))
  .handler(async ({ data }) => {
    const supabase = serverPublic();
    const { data: rows, error } = await supabase.rpc("get_appointment_confirmation", {
      _id: data.id,
    });
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });

export const searchAppointmentsByName = createServerFn({ method: "GET" })
  .inputValidator((d: { name: string }) => ({
    name: z.string().trim().min(3, "Digite ao menos 3 caracteres").max(100).parse(d.name),
  }))
  .handler(async ({ data }) => {
    const supabase = serverPublic();
    const { data: rows, error } = await supabase.rpc("search_appointments_by_name", {
      _name: data.name,
    });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Admin ----------

async function assertAdmin(ctx: { supabase: ReturnType<typeof serverPublic>; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores");
}

export const adminListAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { date?: string }) => ({
    date: d.date ? dateSchema.parse(d.date) : undefined,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin({ supabase: context.supabase as never, userId: context.userId });
    let q = context.supabase
      .from("appointments")
      .select(
        "id, client_name, client_phone, scheduled_at, status, notes, created_at, service:services(id,name,duration_min,price_cents)",
      )
      .order("scheduled_at", { ascending: true });

    if (data.date) {
      const start = `${data.date}T00:00:00.000Z`;
      const endDate = new Date(`${data.date}T00:00:00.000Z`);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      q = q.gte("scheduled_at", start).lt("scheduled_at", endDate.toISOString());
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const statusSchema = z.enum(["scheduled", "confirmed", "completed", "cancelled"]);

export const adminUpdateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: string }) => ({
    id: z.string().uuid().parse(d.id),
    status: statusSchema.parse(d.status),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin({ supabase: context.supabase as never, userId: context.userId });
    const { error } = await context.supabase
      .from("appointments")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({
    id: z.string().uuid().parse(d.id),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin({ supabase: context.supabase as never, userId: context.userId });
    const { error } = await context.supabase.from("appointments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

// ---------- Admin: Serviços ----------

const serviceSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(100),
  description: z.string().trim().max(500).optional().nullable(),
  duration_min: z.number().int().min(5).max(480),
  price_cents: z.number().int().min(0).max(10_000_000),
  active: z.boolean().optional().default(true),
});

export const adminListServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin({ supabase: context.supabase as never, userId: context.userId });
    const { data, error } = await context.supabase
      .from("services")
      .select("id, name, description, duration_min, price_cents, active, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminCreateService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => serviceSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin({ supabase: context.supabase as never, userId: context.userId });
    const { error } = await context.supabase.from("services").insert({
      name: data.name,
      description: data.description ?? null,
      duration_min: data.duration_min,
      price_cents: data.price_cents,
      active: data.active ?? true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => serviceSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin({ supabase: context.supabase as never, userId: context.userId });
    const { error } = await context.supabase
      .from("services")
      .update({
        name: data.name,
        description: data.description ?? null,
        duration_min: data.duration_min,
        price_cents: data.price_cents,
        active: data.active ?? true,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ data, context }) => {
    await assertAdmin({ supabase: context.supabase as never, userId: context.userId });
    const { error } = await context.supabase.from("services").delete().eq("id", data.id);
    if (error) {
      if (error.code === "23503") {
        throw new Error(
          "Este serviço possui agendamentos vinculados. Desative-o em vez de excluir.",
        );
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

