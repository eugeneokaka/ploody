import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Plus, FileText, FolderOpen, ArrowLeft } from "lucide-react";
import { CreateFolderButton } from "@/components/create-folder-button";
import { FolderTitle } from "@/components/folder-title";

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
        select: {
          id: true,
          updatedAt: true,
          currentVersion: { select: { title: true } },
        },
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
      <div className="mx-auto max-w-3xl px-4 sm:px-8 py-6 sm:py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="rounded-full p-1.5 text-stone-500 transition-colors hover:bg-amber-200/50 hover:text-stone-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/25 ring-1 ring-amber-400/30">
              <FolderOpen className="h-5 w-5 text-amber-800" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700/70">
                Folder
              </p>
              <FolderTitle id={folder.id} name={folder.name} />
            </div>
          </div>
        </div>

        <div className="mb-8 flex items-center gap-3">
          <Link
            href={`/notes/new?folderId=${folder.id}`}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/85"
          >
            <Plus className="h-4 w-4" />
            New Note
          </Link>
          <CreateFolderButton parentId={folder.id} />
        </div>

        {folder.children.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-amber-800/70 dark:text-amber-200/70">
              Subfolders
            </h2>
            <div className="flex flex-wrap gap-2">
              {folder.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/folders/${child.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-[#fff9d9]/70 px-3 py-2 text-sm text-stone-700 transition-colors hover:border-amber-400 hover:bg-[#fff3a3]/80 hover:text-stone-900"
                >
                  <FolderOpen className="h-4 w-4 text-amber-600" />
                  <span>{child.name}</span>
                  <span className="rounded-full bg-amber-200/70 px-1.5 text-xs font-semibold text-amber-900">
                    {child._count.notes + child._count.children}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-amber-800/70 dark:text-amber-200/70">
            Notes
          </h2>
          {folder.notes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-amber-300 bg-[#fff9d9]/70 py-12 text-center">
              <FileText className="h-8 w-8 text-amber-500/50" />
              <p className="text-sm font-medium text-stone-700">
                No notes in this folder yet
              </p>
              <Link
                href={`/notes/new?folderId=${folder.id}`}
                className="rounded-full bg-primary/25 px-3 py-1.5 text-sm font-semibold text-amber-900 transition-colors hover:bg-primary/40"
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
                  className="group flex items-center gap-3 rounded-[6px] border border-amber-200/70 bg-card/75 px-4 py-3 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:bg-[#fff9d9]/80"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-amber-800">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate font-semibold text-stone-800 dark:text-stone-100">
                    {note.currentVersion?.title || "Untitled"}
                  </span>
                  <span className="text-xs text-stone-500 dark:text-stone-400">
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
