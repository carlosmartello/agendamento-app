import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Studio.Agenda — Agende seu horário em segundos" },
      {
        name: "description",
        content:
          "Reserve seu horário online com confirmação instantânea. Interface simples, rápida e sem cadastro.",
      },
      { property: "og:title", content: "Studio.Agenda" },
      {
        property: "og:description",
        content: "Reserve seu horário online com confirmação instantânea.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        right={
          <>
            <Link
              to="/consultar"
              className="hidden sm:inline-flex items-center rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Consultar
            </Link>
            <Link
              to="/auth"
              className="hidden sm:inline-flex items-center rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Área administrativa
            </Link>
            <Button asChild size="sm">
              <Link to="/agendar">
                Agendar
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      <main>
        <section className="relative overflow-hidden">
          <div className="grain-bg absolute inset-0 -z-10 opacity-70" />
          <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-24 sm:pt-32 sm:pb-40">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Agendamento em tempo real
              </span>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
                Reserve seu horário
                <br />
                <span className="text-muted-foreground">em menos de um minuto.</span>
              </h1>
              <p className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
                Escolha o serviço, o dia e o horário. Sem cadastro, sem senha.
                Você recebe a confirmação na hora.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 px-6 text-base">
                  <Link to="/agendar">
                    Agendar agora
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="lg" className="h-12 px-6 text-base">
                  <Link to="/consultar">Consultar agendamento</Link>
                </Button>
              </div>
            </div>

            <div className="mx-auto mt-20 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  icon: Clock,
                  title: "Horários em tempo real",
                  desc: "Slots ocupados aparecem indisponíveis instantaneamente.",
                },
                {
                  icon: ShieldCheck,
                  title: "Confirmação imediata",
                  desc: "Guarde o link de confirmação e volte quando quiser.",
                },
                {
                  icon: Sparkles,
                  title: "Sem fricção",
                  desc: "Apenas nome, telefone e o horário desejado.",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
                >
                  <Icon className="h-5 w-5 text-foreground" strokeWidth={2} />
                  <h3 className="mt-4 text-sm font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Studio.Agenda
        </div>
      </footer>
    </div>
  );
}
