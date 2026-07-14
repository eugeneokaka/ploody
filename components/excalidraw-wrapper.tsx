"use client";

import "@excalidraw/excalidraw/index.css";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

const OrigWorker: typeof Worker =
  typeof Worker !== "undefined" ? Worker : (null as unknown as typeof Worker);

if (
  typeof window !== "undefined" &&
  typeof Worker !== "undefined"
) {
  window.Worker = class extends OrigWorker {
    constructor(stringUrl: string | URL, options?: WorkerOptions) {
      if (
        typeof stringUrl === "string" &&
        stringUrl.includes("subset-worker") &&
        stringUrl.startsWith("file://")
      ) {
        super("/excalidraw/subset-worker.chunk.js", options);
      } else {
        super(stringUrl, options);
      }
    }
  } as typeof Worker;
}

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((m) => m.Excalidraw),
  { ssr: false }
) as ComponentType<Record<string, unknown>>;

export default Excalidraw;
