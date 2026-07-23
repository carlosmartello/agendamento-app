import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Check, LogOut, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  adminDeleteAppointment,
  adminListAppointments,
  adminUpdateStatus,
  checkIsAdmin,
} from "@/lib/booking.functions";
import {
  STATUS_LABELS,
  formatDateISO,
  formatPhone,
  formatTime,
  type AppointmentStatus,
} from "@/lib/booking-constants";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel - Studio.Agenda" },
      { name: "description", content: "Gestão de agendamentos." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Painel administrativo" },
      { property: "og:description", content: "Gestão de agendamentos." },
    ],
  }),
  component: AdminPage,
});

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  scheduled: "bg-secondary text-secondary-foreground",
  confirmed: "bg-foreground text-background",
  completed: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-muted text-muted-foreground line-through",
};

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [date, setDate] = useState<Date | undefined>(undefined);

  const checkFn = useServerFn(checkIsAdmin);
  const listFn = useServerFn(adminListAppointments);
  const updateFn = useServerFn(adminUpdateStatus);
  const deleteFn = useServerFn(adminDeleteAppointment);

  const { data: adminCheck, isLoading: checking } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkFn(),
  });

  const dateStr = date ? formatDateISO(date) : undefined;
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["appointments", dateStr ?? "all"],
    queryFn: () => listFn({ data: { date: dateStr } }),
    enabled: !!adminCheck?.isAdmin,
  });

  const updateStatus = useMutation({
    mutationFn: (v: { id: string; status: AppointmentStatus }) => updateFn({ data: v }),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Agendamento excluído");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <p className="p-8 text-sm text-muted-foreground">Verificando acesso...</p>
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta não tem permissão de administrador.
          </p>
          <Button onClick={handleSignOut} className="mt-6">
            Sair
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        right={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to="/servicos">
                <Wrench className="mr-1.5 h-4 w-4" />
                Serviços
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-1.5 h-4 w-4" />
              Sair
            </Button>
          </>
        }
      />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        <header className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Agendamentos
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {rows.length} {rows.length === 1 ? "registro" : "registros"}
              {date ? ` em ${format(date, "PPP", { locale: ptBR })}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !date && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd/MM/yyyy") : "Filtrar por data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  className={cn("p-3 pointer-events-auto")}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            {date && (
              <Button variant="ghost" size="sm" onClick={() => setDate(undefined)}>
                Limpar
              </Button>
            )}
          </div>
        </header>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <p className="text-sm text-muted-foreground">
              Nenhum agendamento {date ? "para esta data" : "ainda"}.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const when = new Date(row.scheduled_at);
              return (
                <Card
                  key={row.id}
                  className="p-4 sm:p-5 grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                >
                  <div className="flex items-center gap-4 sm:flex-col sm:items-start sm:gap-0 sm:min-w-24">
                    <span className="text-2xl font-semibold tabular-nums text-foreground">
                      {formatTime(when)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(when, "dd/MM/yyyy")}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground truncate">{row.client_name}</p>
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
                      {row.service_name} · {row.duration_min} min · {formatPhone(row.client_phone)}
                    </p>
                    {row.notes && (
                      <p className="mt-1 text-xs text-muted-foreground italic">"{row.notes}"</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    {row.status !== "confirmed" &&
                      row.status !== "cancelled" &&
                      row.status !== "completed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateStatus.mutate({
                              id: row.id,
                              status: "confirmed",
                            })
                          }
                          disabled={updateStatus.isPending}
                        >
                          <Check className="mr-1.5 h-4 w-4" />
                          Confirmar
                        </Button>
                      )}
                    <Select
                      value={row.status}
                      onValueChange={(v) =>
                        updateStatus.mutate({
                          id: row.id,
                          status: v as AppointmentStatus,
                        })
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABELS) as AppointmentStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Excluir agendamento">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O registro de{" "}
                            <strong>{row.client_name}</strong> será removido.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => del.mutate(row.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
