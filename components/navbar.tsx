"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Pencil, LogOut, Globe, LayoutDashboard, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession, signOut } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "";

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-amber-200/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary shadow-[0_4px_12px_-6px_rgba(202,138,4,0.75)] ring-1 ring-amber-500/30">
            <Pencil className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Ploody</span>
        </Link>

        <div className="flex-1" />

        <Link
          href="/explore"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            pathname === "/explore"
              ? "bg-primary/25 text-amber-950 dark:bg-primary/15 dark:text-amber-100"
              : "text-muted-foreground hover:bg-primary/15 hover:text-foreground"
          )}
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">Explore</span>
        </Link>

        <Link
          href="/todos"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            pathname === "/todos"
              ? "bg-primary/25 text-amber-950 dark:bg-primary/15 dark:text-amber-100"
              : "text-muted-foreground hover:bg-primary/15 hover:text-foreground"
          )}
        >
          <ListTodo className="h-4 w-4" />
          <span className="hidden sm:inline">Todos</span>
        </Link>

        <Link
          href="/dashboard"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            pathname === "/dashboard"
              ? "bg-primary/25 text-amber-950 dark:bg-primary/15 dark:text-amber-100"
              : "text-muted-foreground hover:bg-primary/15 hover:text-foreground"
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>

        <div className="flex items-center gap-3 shrink-0">
          {isPending ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          ) : session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-8 w-8 cursor-pointer">
                  <AvatarFallback className="bg-primary/25 text-xs font-bold text-amber-800 dark:bg-primary/15 dark:text-amber-200">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-foreground">
                        {session.user.name}
                      </span>
                      <span className="text-xs font-normal">
                        {session.user.email}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex h-8 items-center justify-center rounded-xl bg-primary shadow-[0_4px_12px_-6px_rgba(202,138,4,0.75)] ring-1 ring-amber-500/30 px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
