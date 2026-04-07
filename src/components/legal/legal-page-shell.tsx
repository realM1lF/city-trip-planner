import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPageShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-10 pb-28">
        <p className="mb-8">
          <Link
            href="/"
            className="text-primary text-sm font-medium underline underline-offset-4 hover:no-underline"
          >
            ← Zum Planner
          </Link>
        </p>
        <article className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {children}
        </article>
      </div>
    </div>
  );
}
