"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function CreateFolderButton({ parentId }: { parentId: string }) {
  const router = useRouter();
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      setShowInput(false);
      return;
    }
    setLoading(true);
    await fetch("/api/folders", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), parentId }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {showInput ? (
        <form
          onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
          className="flex items-center gap-2"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name..."
            autoFocus
            className="h-9 w-48 text-sm"
            onBlur={() => { if (!name) setShowInput(false); }}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
            )}
          >
            {loading ? "..." : "Create"}
          </button>
          <button
            type="button"
            onClick={() => setShowInput(false)}
            className="rounded-lg p-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <FolderPlus className="h-4 w-4" />
          New Subfolder
        </button>
      )}
    </div>
  );
}
