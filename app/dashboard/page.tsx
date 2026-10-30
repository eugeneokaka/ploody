import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { FileText, Folder as FolderIcon, BookmarkPlus } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) redirect("/sign-in");

  const notes = await prisma.note.findMany({
    where: { userId: session.user.id, copiedFromId: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      folderId: true,
      updatedAt: true,
      currentVersion: { select: { title: true } },
      folder: { select: { id: true, name: true } },
      copiedFrom: {
        select: {
          id: true,
          currentVersion: { select: { title: true } },
        },
      },
    },
  });
  console.log(notes);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 sm:px-8 py-6 sm:py-8">
        <div className="mb-6">
          <p className="mb-2 inline-flex rounded-full bg-primary/25 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-900 ring-1 ring-amber-400/30 dark:bg-primary/10 dark:text-amber-200">
            Your saved corner
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
            Dashboard
          </h1>
        </div>

        {notes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-amber-300 bg-[#fff9d9]/70 py-16 text-center">
            <BookmarkPlus className="h-12 w-12 text-amber-500/40" />
            <p className="font-medium text-stone-700">No saved notes yet</p>
            <p className="text-sm text-stone-500">
              When you copy a public note, it will appear here.
            </p>
            <Link
              href="/explore"
              className="rounded-full bg-primary/25 px-3 py-1.5 text-sm font-semibold text-amber-900 transition-colors hover:bg-primary/40"
            >
              Explore public notes
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((note) => (
              <Link
                key={note.id}
                href={`/notes/${note.id}`}
                className="group flex items-center gap-3 rounded-[6px] border border-amber-200/70 bg-card/75 px-4 py-3 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:bg-[#fff9d9]/80"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-amber-800">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="flex-1 truncate font-semibold text-stone-800 dark:text-stone-100">
                  {note.currentVersion?.title || "Untitled"}
                </span>
                {note.copiedFrom && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800">
                    <BookmarkPlus className="h-3 w-3" />
                    {note.copiedFrom.currentVersion?.title || "Untitled"}
                  </span>
                )}
                {note.folder && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800">
                    <FolderIcon className="h-3 w-3" />
                    {note.folder.name}
                  </span>
                )}
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  {new Date(note.updatedAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
