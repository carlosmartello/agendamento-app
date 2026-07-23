import { Link } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";

interface Props {
  right?: React.ReactNode;
}

export function SiteHeader({ right }: Props) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            <CalendarCheck className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <span className="font-semibold tracking-tight text-foreground">
            Studio<span className="text-muted-foreground">.Agenda</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2 text-sm">{right}</nav>
      </div>
    </header>
  );
}