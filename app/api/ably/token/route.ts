import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAblyRest } from "@/lib/ably-server";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ably = getAblyRest();
    const tokenDetails = await ably.auth.requestToken({
      clientId: session.user.id,
      capability: {
        "note:*:comments": ["publish", "subscribe", "history"],
      },
    });

    return NextResponse.json(tokenDetails);
  } catch (e) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
