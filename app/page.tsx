import Link from "next/link";
import { Pencil } from "lucide-react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { FolderSidebar } from "@/components/folder-sidebar";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    return (
      <div className="flex flex-1">
        <div className="w-[260px] shrink-0 border-r border-border">
          <FolderSidebar />
        </div>
        <main className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <FolderIcon className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Select a folder or create a new note
            </p>
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

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  );
}
