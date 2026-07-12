import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("folders");

async function getUserId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const parentId = req.nextUrl.searchParams.get("parentId") || null;

    log.info("Listing folders", { parentId, userId });

    const folders = await prisma.folder.findMany({
      where: { userId, parentId },
      include: { _count: { select: { notes: true, children: true } } },
      orderBy: { createdAt: "asc" },
    });

    log.info(`Returned ${folders.length} folders`);
    return NextResponse.json(folders);
  } catch (e) {
    log.error("Failed to fetch folders", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { name, parentId } = await req.json();

    log.info("Creating folder", { name, parentId });

    if (!name?.trim()) {
      log.warn("Empty folder name rejected");
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const folder = await prisma.folder.create({
      data: { name: name.trim(), userId, parentId: parentId ?? null },
    });

    log.info(`Folder created`, { folderId: folder.id });
    return NextResponse.json(folder);
  } catch (e) {
    log.error("Failed to create folder", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
