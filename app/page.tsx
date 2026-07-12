import Link from "next/link";
import { Pencil, FileText } from "lucide-react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { FolderBar } from "@/components/folder-bar";
import { SearchBar } from "@/components/search";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="border-b border-border px-4 py-3">
          <div className="mx-auto w-full max-w-2xl">
            <SearchBar />
          </div>
        </div>
        <div className="border-b border-border">
          <FolderBar />
        </div>
        <main className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <FileText className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Select a folder or create a new note
            </p>
            <Link
              href="/notes/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              <Plus className="h-3.5 w-3.5" />
              New Note
            </Link>
          </div>
        </main>
      </div>
    );
  }

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

function Plus({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  );
}

