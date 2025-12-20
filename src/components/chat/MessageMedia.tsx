import React from "react";
import { FileText, Download } from "lucide-react";
import GalleryGrid from "@/components/chat/GalleryGrid";

export interface MessageMediaPayload {
  media_url?: string | null;
  media_type?: string | null;
  content?: string;
}

const MEDIA_MAX_W_CLASS = "max-w-[300px]";
const MEDIA_MAX_H_CLASS = "max-h-[400px]";

const MessageMedia: React.FC<{ message: MessageMediaPayload }> = ({ message }) => {
  if (!message.media_url) return null;

  if (message.media_type === "gallery") {
    try {
      const urls = JSON.parse(message.media_url) as string[];
      if (Array.isArray(urls) && urls.length > 0) {
        return <GalleryGrid urls={urls} />;
      }
    } catch {
      // fall through
    }
  }

  if (message.media_type === "image") {
    return (
      <img
        src={message.media_url}
        alt="Shared image"
        loading="lazy"
        className={`${MEDIA_MAX_W_CLASS} ${MEDIA_MAX_H_CLASS} w-full rounded-lg mb-2 cursor-pointer object-cover`}
        onClick={() => window.open(message.media_url!, "_blank")}
      />
    );
  }

  if (message.media_type === "video") {
    return (
      <video
        src={message.media_url}
        controls
        className={`${MEDIA_MAX_W_CLASS} ${MEDIA_MAX_H_CLASS} w-full rounded-lg mb-2 object-cover`}
      />
    );
  }

  // Document/other files
  const fileName = message.media_url.split("/").pop() || "File";
  return (
    <a
      href={message.media_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-2 bg-background/20 rounded-lg mb-2 hover:bg-background/30 transition-colors"
    >
      <FileText className="w-5 h-5" />
      <span className="text-sm truncate flex-1">{fileName}</span>
      <Download className="w-4 h-4" />
    </a>
  );
};

export default MessageMedia;
