import React, { useState } from "react";
import ImageLightbox from "@/components/chat/ImageLightbox";

interface GalleryGridProps {
  urls: string[];
  maxVisible?: number;
  onImageClick?: (index: number) => void;
}

const GalleryGrid: React.FC<GalleryGridProps> = ({ urls, maxVisible = 4, onImageClick }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const total = urls.length;
  const visible = urls.slice(0, maxVisible);
  const overflow = Math.max(0, total - visible.length);

  const gridClassName =
    total === 2
      ? "grid grid-cols-2 gap-1"
      : total === 3
        ? "grid grid-cols-2 grid-rows-2 gap-1"
        : "grid grid-cols-2 grid-rows-2 gap-1";

  const getTileClassName = (index: number) => {
    if (total === 3 && index === 0) return "relative row-span-2";
    return "relative";
  };

  const handleImageClick = (index: number) => {
    if (onImageClick) {
      onImageClick(index);
    } else {
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
  };

  return (
    <>
      <div className="mb-2 w-[300px] max-w-full max-h-[400px] overflow-hidden rounded-lg">
        <div className={gridClassName}>
          {visible.map((url, index) => {
            const isLastVisible = index === visible.length - 1;
            const showOverflow = overflow > 0 && isLastVisible;

            return (
              <button
                key={`${url}-${index}`}
                type="button"
                onClick={() => handleImageClick(index)}
                className={`${getTileClassName(index)} block w-full aspect-square overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:opacity-90 transition-opacity`}
                aria-label="Open shared image"
              >
                <img
                  src={url}
                  alt="Shared image gallery item"
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {showOverflow && (
                  <div className="absolute inset-0 grid place-items-center bg-background/50">
                    <span className="text-sm font-semibold text-foreground">+{overflow}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {!onImageClick && (
        <ImageLightbox
          images={urls}
          initialIndex={lightboxIndex}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      )}
    </>
  );
};

export default GalleryGrid;
