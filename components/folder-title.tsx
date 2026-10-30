"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface FolderTitleProps {
  id: string;
  name: string;
}

export function FolderTitle({ id, name }: FolderTitleProps) {
  const router = useRouter();
  const [currentName, setCurrentName] = useState(name);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  async function save() {
    const trimmed = value.trim();
    if (!trimmed) {
      setValue(currentName);
      setEditing(false);
      return;
    }
    setEditing(false);
    if (trimmed === currentName) return;

    const previous = currentName;
    setCurrentName(trimmed);

    try {
      const res = await fetch(`/api/folders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Failed to rename folder");
      toast.success("Folder renamed.");
      router.refresh();
    } catch {
      setCurrentName(previous);
      setValue(previous);
      toast.error("Couldn't rename that folder. Try again?");
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setValue(currentName);
              setEditing(false);
            }
          }}
          maxLength={120}
          autoFocus
          aria-label="Folder name"
          className="h-9 max-w-xs text-lg font-bold"
        />
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-50">
        {currentName}
      </h1>
      <button
        type="button"
        onClick={() => {
          setValue(currentName);
          setEditing(true);
        }}
        aria-label="Rename folder"
        title="Rename folder"
        className="rounded-full p-1.5 text-stone-500 transition-colors hover:bg-amber-200/50 hover:text-stone-900"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
}
