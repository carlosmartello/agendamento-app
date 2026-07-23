import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, CalendarCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { searchAppointmentsByName } from "@/lib/booking.functions";
import {
  STATUS_LABELS,
  formatDateLong,
  formatTime,
  type AppointmentStatus,
} from "@/lib/booking-constants";

export const Route = createFileRoute("/consultar")({
  head: () => ({
    meta: [
      { title: "Consultar agendamento — Studio.Agenda" },
      {
        name: "description",
        content: "Consulte seus agendamentos pelo nome informado no cadastro.",
      },
      { property: "og:title", content: "Consultar agendamento — Studio.Agenda" },
      {
        property: "og:description",
        content: "Consulte seus agendamentos pelo nome informado no cadastro.",
      },
    ],
  }),
  component: ConsultarPage,
});

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  scheduled: "bg-amber-100 text-amber-900 border-amber-200",
  confirmed: "bg-emerald-100 text-emerald-900 border-emerald-200",
  completed: "bg-emerald-600 text-white border-emerald-700",
  cancelled: "bg-red-100 text-red-900 border-red-200 line-through",
};

function ConsultarPage() {
  const [name, setName] = useState("");
  const [searched, setSearched] = useState(false);
  const fn = useServerFn(searchAppointmentsByName);

  const search = useMutation({
    mutationFn: (n: string) => fn({ data: { name: n } }),
    onSuccess: () => setSearched(true),
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      toast.error("Digite ao menos 3 caracteres do seu nome.");
      return;
    }
    search.mutate(trimmed);
  }

  const rows = search.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        right={
          <Button asChild variant="ghost" size="sm">
            <Link to="/agendar">
              <CalendarCheck className="mr-1.5 h-4 w-4" />
              Agendar
            </Link>
          </Button>
        }
      />

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Consultar agendamento
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Digite exatamente o nome informado ao agendar para ver seus
            horários.
          </p>
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <form onSubmit={submit} className="flex gap-2">
              <Input
                autoFocus
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
              <Button type="submit" disabled={search.isPending}>
                <Search className="mr-1.5 h-4 w-4" />
                {search.isPending ? "Buscando..." : "Buscar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {searched && !search.isPending && (
          <div className="mt-6 space-y-3">
            {rows.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <p className="text-sm text-muted-foreground">
                  Nenhum agendamento encontrado para esse nome.
                </p>
                <Button asChild variant="link" className="mt-2">
                  <Link to="/agendar">Fazer um novo agendamento</Link>
                </Button>
              </Card>
            ) : (
              rows.map((row) => {
                const when = new Date(row.scheduled_at);
                return (
                  <Card
                    key={row.id}
                    className="p-4 sm:p-5 grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  >
                    <div className="flex items-center gap-4 sm:flex-col sm:items-start sm:gap-0 sm:min-w-28">
                      <span className="text-2xl font-semibold tabular-nums text-foreground">
                        {formatTime(when)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateLong(when)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground truncate">
                          {row.client_name}
                        </p>
                        <Badge
                          className={cn(
                            "font-normal",
                            STATUS_STYLES[row.status as AppointmentStatus],
                          )}
                        >
                          {STATUS_LABELS[row.status as AppointmentStatus]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {row.service_name} · {row.duration_min} min
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link
                        to="/agendar/confirmacao/$id"
                        params={{ id: row.id }}
                      >
                        Ver detalhes
                      </Link>
                    </Button>
                  </Card>
                );
              })
            )}
          </div>
        )}

        <Button asChild variant="ghost" className="mt-8">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao início
          </Link>
        </Button>
      </main>
    </div>
  );
}