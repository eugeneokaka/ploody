import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Plus, FileText, FolderOpen, ArrowLeft } from "lucide-react";
import { CreateFolderButton } from "@/components/create-folder-button";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FolderPage({ params }: Props) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) redirect("/sign-in");

  const { id } = await params;

  const folder = await prisma.folder.findUnique({
    where: { id, userId: session.user.id },
    include: {
      notes: {
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, updatedAt: true },
      },
      children: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, _count: { select: { notes: true, children: true } } },
      },
    },
  });

  if (!folder) redirect("/");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">{folder.name}</h1>
            </div>
          </div>
        </div>

        <div className="mb-8 flex items-center gap-3">
          <Link
            href={`/notes/new?folderId=${folder.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            <Plus className="h-4 w-4" />
            New Note
          </Link>
          <CreateFolderButton parentId={folder.id} />
        </div>

        {folder.children.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              Subfolders
            </h2>
            <div className="flex flex-wrap gap-2">
              {folder.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/folders/${child.id}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span>{child.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {child._count.notes + child._count.children}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Notes
          </h2>
          {folder.notes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No notes in this folder yet
              </p>
              <Link
                href={`/notes/new?folderId=${folder.id}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Create your first note
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {folder.notes.map((note) => (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 font-medium">{note.title || "Untitled"}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
