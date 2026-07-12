import Link from "next/link";
import { Pencil } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
          <Pencil className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="text-5xl font-bold tracking-tight">Ploody</h1>
        <p className="max-w-sm text-lg leading-relaxed text-[#4a4a4a] dark:text-zinc-400">
          A beautiful notes app. Write, organize, and share your thoughts.
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/sign-up"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          Sign Up
        </Link>
        <Link
          href="/sign-in"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-5 text-sm font-medium transition-colors hover:bg-muted"
        >
          Sign In
        </Link>
      </div>
    </main>
  );
}
