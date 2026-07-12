import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("folders:[id]");

async function getUserId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;
    const { name } = await req.json();

    log.info("Renaming folder", { id, name });

    if (!name?.trim()) {
      log.warn("Empty folder name rejected");
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    await prisma.folder.update({
      where: { id, userId },
      data: { name: name.trim() },
    });

    log.info(`Folder renamed`, { id });
    return NextResponse.json({ success: true });
  } catch (e) {
    log.error("Failed to rename folder", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;

    log.info("Deleting folder", { id });

    await prisma.folder.delete({
      where: { id, userId },
    });

    log.info(`Folder deleted`, { id });
    return NextResponse.json({ success: true });
  } catch (e) {
    log.error("Failed to delete folder", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
