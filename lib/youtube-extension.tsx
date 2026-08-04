"use client";

import { Node } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { Trash2, ExternalLink, Video, Pencil } from "lucide-react";

export function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function getYoutubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function YoutubeNodeView({
  node,
  updateAttributes,
  deleteNode,
}: ReactNodeViewProps) {
  const { videoId, url } = node.attrs as { videoId: string; url: string };

  const handleEdit = () => {
    const newUrl = window.prompt("YouTube URL:", url);
    if (newUrl && newUrl !== url) {
      const newVideoId = extractYoutubeId(newUrl);
      if (newVideoId) {
        updateAttributes({ url: newUrl, videoId: newVideoId });
      } else {
        alert("Invalid YouTube URL");
      }
    }
  };

  const handleOpenYoutube = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <NodeViewWrapper>
      <div className="youtube-block" contentEditable={false}>
        <div className="relative group border border-border rounded-lg overflow-hidden not-prose">
          <div className="aspect-video bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?rel=0`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              type="button"
              onClick={handleEdit}
              className="h-7 w-7 rounded-md bg-background/90 border border-border flex items-center justify-center hover:bg-muted transition-colors"
              title="Change video"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleOpenYoutube}
              className="h-7 w-7 rounded-md bg-background/90 border border-border flex items-center justify-center hover:bg-muted transition-colors"
              title="Open on YouTube"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={deleteNode}
              className="h-7 w-7 rounded-md bg-background/90 border border-border flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Remove video"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const YoutubeExtension = Node.create({
  name: "youtube",
  group: "block",
  atom: true,
  inline: false,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      url: { default: "" },
      videoId: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="youtube"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { url, videoId } = HTMLAttributes;
    return [
      "div",
      {
        "data-type": "youtube",
        "data-url": url,
        "data-video-id": videoId,
      },
      [
        "iframe",
        {
          src: `https://www.youtube.com/embed/${videoId}?rel=0`,
          class: "w-full aspect-video",
          allowfullscreen: "",
          frameborder: "0",
        },
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(YoutubeNodeView);
  },
});
