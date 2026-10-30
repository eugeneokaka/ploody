import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { TodoBoard } from "@/components/todo-board";

export const metadata: Metadata = {
  title: "Sticky Todos | Ploody",
  description: "A happy little place for your tasks.",
};

export default async function TodosPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) redirect("/sign-in");

  return (
    <div className="flex flex-1 flex-col">
      <TodoBoard />
    </div>
  );
}
