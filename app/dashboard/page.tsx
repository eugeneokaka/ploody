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
      <div className="mx-auto max-w-3xl px-8 py-8">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">Dashboard</h1>

        {notes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <BookmarkPlus className="h-12 w-12 text-muted-foreground/20" />
            <p className="text-muted-foreground">No saved notes yet</p>
            <p className="text-sm text-muted-foreground">
              When you copy a public note, it will appear here.
            </p>
            <Link
              href="/explore"
              className="text-sm font-medium text-primary hover:underline"
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
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate font-medium">
                  {note.currentVersion?.title || "Untitled"}
                </span>
                {note.copiedFrom && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    <BookmarkPlus className="h-3 w-3" />
                    {note.copiedFrom.currentVersion?.title || "Untitled"}
                  </span>
                )}
                {note.folder && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    <FolderIcon className="h-3 w-3" />
                    {note.folder.name}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
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
