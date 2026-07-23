import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createAppointment, listBookedSlots, listServices } from "@/lib/booking.functions";
import {
  formatCurrency,
  formatDateISO,
  formatPhone,
  formatTime,
  generateDaySlots,
  addMinutes,
  getBusinessClose,
  intervalsOverlap,
  isBusinessDay,
} from "@/lib/booking-constants";

export const Route = createFileRoute("/agendar")({
  head: () => ({
    meta: [
      { title: "Agendar horário — Studio.Agenda" },
      {
        name: "description",
        content: "Escolha o serviço, o dia e o horário. Confirmação instantânea.",
      },
      { property: "og:title", content: "Agendar horário — Studio.Agenda" },
      {
        property: "og:description",
        content: "Escolha o serviço, o dia e o horário.",
      },
    ],
  }),
  component: AgendarPage,
});

function AgendarPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    // Se hoje for domingo, avança 1 dia
    while (!isBusinessDay(d)) d.setDate(d.getDate() + 1);
    return d;
  });
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");

  const servicesFn = useServerFn(listServices);
  const bookedFn = useServerFn(listBookedSlots);
  const createFn = useServerFn(createAppointment);

  const { data: services = [] } = useQuery({
    queryKey: ["services"],
    queryFn: () => servicesFn(),
  });

  const dateStr = date ? formatDateISO(date) : null;
  const { data: booked = [], isLoading: bookedLoading } = useQuery({
    queryKey: ["booked-slots", dateStr],
    queryFn: () => bookedFn({ data: { date: dateStr! } }),
    enabled: !!dateStr,
  });

  const selectedService = services.find((s) => s.id === serviceId) ?? null;
  const selectedDuration = selectedService?.duration_min ?? 0;

  const bookedIntervals = useMemo(
    () =>
      booked.map((b) => {
        const start = new Date(b.scheduled_at);
        return {
          start,
          end: addMinutes(start, b.duration_min),
        };
      }),
    [booked],
  );

  const slots = useMemo(() => (date ? generateDaySlots(date) : []), [date]);

  type CreatePayload = {
    client_name: string;
    client_phone: string;
    service_id: string;
    scheduled_at: string;
    notes?: string;
  };
  const create = useMutation({
    mutationFn: (payload: CreatePayload) => createFn({ data: payload }),
    onSuccess: async ({ id }) => {
      toast.success("Agendamento realizado!");
      await qc.invalidateQueries({ queryKey: ["booked-slots"] });
      navigate({
        to: "/agendar/confirmacao/$id",
        params: { id },
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceId) return toast.error("Selecione um serviço");
    if (!selectedSlot) return toast.error("Selecione um horário");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return toast.error("Telefone inválido");
    if (name.trim().length < 2) return toast.error("Informe seu nome");

    create.mutate({
      client_name: name.trim(),
      client_phone: digits,
      service_id: serviceId,
      scheduled_at: selectedSlot.toISOString(),
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        right={
          <>
            <Link to="/consultar" className="text-sm text-muted-foreground hover:text-foreground">
              Consultar
            </Link>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              Voltar
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Novo agendamento
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Preencha os dados abaixo. A confirmação é imediata.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Serviços */}
          <section aria-labelledby="s-service">
            <h2 id="s-service" className="mb-3 text-sm font-medium text-foreground">
              1. Serviço
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setServiceId(s.id);
                    setSelectedSlot(null);
                  }}
                  className={cn(
                    "text-left rounded-xl border p-4 transition-all",
                    serviceId === s.id
                      ? "border-foreground bg-secondary ring-1 ring-foreground/10"
                      : "border-border hover:border-foreground/40 bg-card",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{s.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{s.duration_min} min</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-foreground">
                      {formatCurrency(s.price_cents)}
                    </span>
                  </div>
                  {s.description && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {s.description}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Data e horário */}
          <section aria-labelledby="s-when">
            <h2 id="s-when" className="mb-3 text-sm font-medium text-foreground">
              2. Data e horário
            </h2>
            <Card className="border-border/60">
              <CardContent className="p-4 sm:p-5 space-y-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full sm:w-64 justify-start text-left font-normal",
                        !date && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP", { locale: ptBR }) : "Escolha a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => {
                        setDate(d);
                        setSelectedSlot(null);
                      }}
                      disabled={(d) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        if (d < today) return true;
                        if (!isBusinessDay(d)) return true;
                        return false;
                      }}
                      className={cn("p-3 pointer-events-auto")}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>

                {date && (
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">
                      {bookedLoading ? "Carregando horários..." : "Horários disponíveis"}
                    </p>
                    {selectedService ? (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {slots.map((slot) => {
                          const slotEnd = addMinutes(slot, selectedDuration || 0);
                          const exceedsBusinessHours =
                            !selectedService || slotEnd > getBusinessClose(slot);
                          const isBooked =
                            selectedService &&
                            bookedIntervals.some(({ start, end }) =>
                              intervalsOverlap(slot, slotEnd, start, end),
                            );
                          const isPast = slot.getTime() < Date.now();
                          const disabled =
                            !selectedService || Boolean(isBooked) || isPast || exceedsBusinessHours;
                          const active = selectedSlot?.getTime() === slot.getTime();
                          return (
                            <button
                              key={slot.getTime()}
                              type="button"
                              disabled={disabled}
                              onClick={() => setSelectedSlot(slot)}
                              className={cn(
                                "rounded-lg border py-2 text-sm font-medium transition-colors",
                                active
                                  ? "border-foreground bg-foreground text-background"
                                  : disabled
                                    ? "border-border/50 bg-muted/40 text-muted-foreground/50 cursor-not-allowed line-through"
                                    : "border-border bg-card text-foreground hover:border-foreground/60",
                              )}
                              aria-label={`Horário ${formatTime(slot)}${isBooked ? " (indisponível)" : ""}`}
                            >
                              <span className="block">{formatTime(slot)}</span>
                              {selectedService && (
                                <span className="block text-[10px] font-normal opacity-75">
                                  {formatTime(slotEnd)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                        Selecione um serviÃ§o acima para calcular a duraÃ§Ã£o e os horÃ¡rios livres.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Dados */}
          <section aria-labelledby="s-contact">
            <h2 id="s-contact" className="mb-3 text-sm font-medium text-foreground">
              3. Seus dados
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  inputMode="tel"
                  required
                  autoComplete="tel"
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="notes">Observações (opcional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
              </div>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-6">
            <Button asChild variant="ghost">
              <Link to="/">Cancelar</Link>
            </Button>
            <Button type="submit" size="lg" disabled={create.isPending} className="min-w-40">
              {create.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Confirmar agendamento
                </>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
