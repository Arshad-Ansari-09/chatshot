import React, { useState } from "react";
import { FileText, Download, FileSpreadsheet, FileImage, FileVideo, File } from "lucide-react";
import GalleryGrid from "@/components/chat/GalleryGrid";
import ImageLightbox from "@/components/chat/ImageLightbox";

export interface MessageMediaPayload {
  media_url?: string | null;
  media_type?: string | null;
  content?: string;
}

const MEDIA_MAX_W_CLASS = "max-w-[300px]";
const MEDIA_MAX_H_CLASS = "max-h-[400px]";

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return <FileText className="w-8 h-8 text-red-400" />;
  if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return <FileText className="w-8 h-8 text-blue-400" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet className="w-8 h-8 text-green-400" />;
  if (['ppt', 'pptx'].includes(ext)) return <FileText className="w-8 h-8 text-orange-400" />;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <File className="w-8 h-8 text-yellow-400" />;
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return <File className="w-8 h-8 text-purple-400" />;
  return <File className="w-8 h-8 text-muted-foreground" />;
};

const getReadableFileName = (url: string, content?: string): string => {
  // Try to extract name from content (e.g. "📎 report.pdf")
  if (content) {
    const match = content.match(/📎\s*(.+)/);
    if (match && match[1] && match[1] !== 'File') return match[1];
  }
  // Fallback: extract from URL, removing the userId/timestamp prefix
  const segments = url.split('/');
  const last = segments.pop() || 'File';
  // Remove timestamp prefix pattern like "1234567890."
  const cleaned = last.replace(/^\d+\./, '');
  return decodeURIComponent(cleaned) || last;
};

const formatFileSize = (name: string): string => {
  const ext = name.split('.').pop()?.toUpperCase() || '';
  return ext ? `${ext} file` : 'File';
};

const handleDownload = async (url: string, fileName: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
};

const MessageMedia: React.FC<{ message: MessageMediaPayload }> = ({ message }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!message.media_url) return null;

  if (message.media_type === "gallery") {
    try {
      const urls = JSON.parse(message.media_url) as string[];
      if (Array.isArray(urls) && urls.length > 0) {
        return (
          <>
            <GalleryGrid
              urls={urls}
              onImageClick={(index) => {
                setLightboxIndex(index);
                setLightboxOpen(true);
              }}
            />
            <ImageLightbox
              images={urls}
              initialIndex={lightboxIndex}
              open={lightboxOpen}
              onOpenChange={setLightboxOpen}
            />
          </>
        );
      }
    } catch {
      // fall through
    }
  }

  if (message.media_type === "image") {
    return (
      <>
        <img
          src={message.media_url}
          alt="Shared image"
          loading="lazy"
          className={`${MEDIA_MAX_W_CLASS} ${MEDIA_MAX_H_CLASS} w-full rounded-lg mb-2 cursor-pointer object-cover hover:opacity-90 transition-opacity`}
          onClick={() => setLightboxOpen(true)}
        />
        <ImageLightbox
          images={[message.media_url]}
          initialIndex={0}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      </>
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

  // Document / any other file type — show with icon + download
  const fileName = getReadableFileName(message.media_url, message.content);
  const fileType = formatFileSize(fileName);

  return (
    <div
      onClick={() => handleDownload(message.media_url!, fileName)}
      className="flex items-center gap-3 p-3 bg-background/20 rounded-xl mb-2 hover:bg-background/30 transition-colors cursor-pointer min-w-[200px] max-w-[300px]"
    >
      {getFileIcon(fileName)}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fileName}</p>
        <p className="text-xs opacity-60">{fileType}</p>
      </div>
      <Download className="w-5 h-5 opacity-70 flex-shrink-0" />
    </div>
  );
};

export default MessageMedia;
