import Link from "next/link";
import { Pencil } from "lucide-react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { FolderGrid } from "@/components/folder-grid";
import { SearchBar } from "@/components/search";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="border-b border-amber-200/60 px-4 py-4">
          <div className="mx-auto w-full max-w-2xl rounded-full sunny-panel p-1.5 shadow-sm backdrop-blur">
            <SearchBar />
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">
          <FolderGrid />
        </main>
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="absolute left-[10%] top-[20%] hidden h-24 w-24 -rotate-6 rounded-[5px] border border-pink-300 bg-[#ffc9da] shadow-lg lg:block"
      />
      <div
        aria-hidden
        className="absolute right-[12%] top-[28%] hidden h-20 w-20 rotate-6 rounded-[5px] border border-sky-300 bg-[#bfe6ff] shadow-lg lg:block"
      />
      <div
        aria-hidden
        className="absolute bottom-[16%] left-[18%] hidden h-16 w-16 -rotate-3 rounded-[5px] border border-emerald-300 bg-[#c9f2c7] shadow-lg lg:block"
      />

      <div className="tape-accent sticky-note relative w-full max-w-xl rotate-1 rounded-[8px] px-6 py-10 text-center transition-transform duration-200 hover:rotate-0 sm:px-10 sm:py-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-900 shadow-md">
          <Pencil className="h-8 w-8 text-primary" />
        </div>
        <h1 className="mt-5 text-5xl font-bold tracking-tight text-stone-900">
          Ploody
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-stone-600">
          A sunny little notes app. Write, organize, and share your thoughts —
          one happy sticky note at a time.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/sign-up"
            className="inline-flex h-10 items-center justify-center rounded-full bg-stone-900 px-6 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-stone-800"
          >
            Sign Up
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex h-10 items-center justify-center rounded-full border border-stone-900/15 bg-white/50 px-6 text-sm font-semibold text-stone-800 transition-colors hover:bg-white/80"
          >
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
