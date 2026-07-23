import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ArrowLeft, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getConfirmation } from "@/lib/booking.functions";
import {
  STATUS_LABELS,
  formatDateLong,
  formatTime,
} from "@/lib/booking-constants";

export const Route = createFileRoute("/agendar/confirmacao/$id")({
  head: () => ({
    meta: [
      { title: "Agendamento confirmado — Studio.Agenda" },
      {
        name: "description",
        content: "Detalhes do seu agendamento.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Agendamento confirmado" },
      { property: "og:description", content: "Detalhes do seu agendamento." },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getConfirmation);
  const { data, isLoading } = useQuery({
    queryKey: ["confirmation", id],
    queryFn: () => fn({ data: { id } }),
  });
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 sm:px-6 py-12">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !data ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Agendamento não encontrado.</p>
              <Button asChild className="mt-4">
                <Link to="/agendar">Fazer novo agendamento</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <div className="grain-bg border-b border-border/60 p-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-foreground text-background">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                Agendamento confirmado
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Guarde este link para consulta.
              </p>
            </div>
            <CardContent className="p-6 sm:p-8">
              <dl className="space-y-4 text-sm">
                <Row label="Cliente" value={data.client_name} />
                <Row label="Serviço" value={data.service_name} />
                <Row
                  label="Data"
                  value={formatDateLong(new Date(data.scheduled_at))}
                />
                <Row
                  label="Horário"
                  value={`${formatTime(new Date(data.scheduled_at))} (${data.duration_min} min)`}
                />
                <Row label="Status" value={STATUS_LABELS[data.status]} />
              </dl>

              <div className="mt-8 space-y-2">
                <Button onClick={handleCopy} variant="outline" className="w-full">
                  {copied ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copied ? "Link copiado" : "Copiar link da confirmação"}
                </Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link to="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar ao início
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-3 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground text-right">{value}</dd>
    </div>
  );
}