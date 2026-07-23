import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import {
  adminCreateService,
  adminDeleteService,
  adminListServices,
  adminUpdateService,
  checkIsAdmin,
} from "@/lib/booking.functions";

export const Route = createFileRoute("/_authenticated/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — Studio.Agenda" },
      { name: "description", content: "Gerencie o catálogo de serviços." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Gestão de serviços" },
      { property: "og:description", content: "Cadastro do catálogo de serviços." },
    ],
  }),
  component: ServicesPage,
});

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price_cents: number;
  active: boolean;
};

type FormState = {
  name: string;
  description: string;
  duration_min: string;
  price_reais: string;
  active: boolean;
};

const EMPTY: FormState = {
  name: "",
  description: "",
  duration_min: "30",
  price_reais: "0",
  active: true,
};

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function ServicesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const checkFn = useServerFn(checkIsAdmin);
  const listFn = useServerFn(adminListServices);
  const createFn = useServerFn(adminCreateService);
  const updateFn = useServerFn(adminUpdateService);
  const deleteFn = useServerFn(adminDeleteService);

  const { data: adminCheck, isLoading: checking } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkFn(),
  });

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["admin-services"],
    queryFn: () => listFn(),
    enabled: !!adminCheck?.isAdmin,
  });

  const save = useMutation({
    mutationFn: async () => {
      const price = Math.round(
        Number(form.price_reais.replace(",", ".")) * 100,
      );
      const duration = Number(form.duration_min);
      if (!form.name.trim() || form.name.trim().length < 2) {
        throw new Error("Informe um nome válido");
      }
      if (!Number.isFinite(duration) || duration < 5) {
        throw new Error("Duração inválida (mín. 5 min)");
      }
      if (!Number.isFinite(price) || price < 0) {
        throw new Error("Preço inválido");
      }
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        duration_min: duration,
        price_cents: price,
        active: form.active,
      };
      if (editing) {
        await updateFn({ data: { id: editing.id, ...payload } });
      } else {
        await createFn({ data: payload });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Serviço atualizado" : "Serviço criado");
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["admin-services"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Serviço excluído");
      qc.invalidateQueries({ queryKey: ["admin-services"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(s: ServiceRow) {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description ?? "",
      duration_min: String(s.duration_min),
      price_reais: (s.price_cents / 100).toFixed(2),
      active: s.active,
    });
    setOpen(true);
  }

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
              <Link to="/admin">
                <CalendarDays className="mr-1.5 h-4 w-4" />
                Agendamentos
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
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              Serviços
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {services.length} {services.length === 1 ? "serviço" : "serviços"} no catálogo
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="mr-1.5 h-4 w-4" /> Novo serviço
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Editar serviço" : "Novo serviço"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex.: Corte masculino"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="desc">Descrição</Label>
                  <Textarea
                    id="desc"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    rows={3}
                    placeholder="Detalhes opcionais"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="dur">Duração (min)</Label>
                    <Input
                      id="dur"
                      type="number"
                      min={5}
                      step={5}
                      value={form.duration_min}
                      onChange={(e) =>
                        setForm({ ...form, duration_min: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="price">Preço (R$)</Label>
                    <Input
                      id="price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.price_reais}
                      onChange={(e) =>
                        setForm({ ...form, price_reais: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Ativo</p>
                    <p className="text-xs text-muted-foreground">
                      Disponível para agendamento público
                    </p>
                  </div>
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => setForm({ ...form, active: v })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={save.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => save.mutate()}
                  disabled={save.isPending}
                >
                  {save.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : services.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <p className="text-sm text-muted-foreground">
              Nenhum serviço cadastrado. Clique em “Novo serviço”.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {services.map((s) => (
              <Card
                key={s.id}
                className="p-4 sm:p-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground truncate">
                      {s.name}
                    </p>
                    {!s.active && (
                      <Badge variant="secondary" className="font-normal">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  {s.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {s.description}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {s.duration_min} min · {formatBRL(s.price_cents)}
                  </p>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(s as ServiceRow)}
                    aria-label="Editar serviço"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir serviço"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir serviço?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se houver agendamentos vinculados, a exclusão será
                          bloqueada — nesse caso, desative o serviço.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => del.mutate(s.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}