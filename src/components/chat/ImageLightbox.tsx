import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  initialIndex = 0,
  open,
  onOpenChange,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setIsZoomed(false);
    }
  }, [open, initialIndex]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    setIsZoomed(false);
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    setIsZoomed(false);
  }, [images.length]);

  const handleDownload = async () => {
    const imageUrl = images[currentIndex];
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `image-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      // Fallback: open in new tab
      window.open(imageUrl, "_blank");
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowLeft") goToPrevious();
      if (e.key === "ArrowRight") goToNext();
      if (e.key === "Escape") onOpenChange(false);
    },
    [open, goToPrevious, goToNext, onOpenChange]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleTouchStart = React.useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    handleTouchStart.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (handleTouchStart.current === null) return;
    const diff = handleTouchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToNext();
      else goToPrevious();
    }
    handleTouchStart.current = null;
  };

  if (images.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="max-w-none w-screen h-screen p-0 border-none bg-black/95 flex items-center justify-center"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Top controls */}
        <div className="absolute top-4 right-4 z-50 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="text-white hover:bg-white/20 rounded-full"
          >
            <Download className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="text-white hover:bg-white/20 rounded-full"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Image counter */}
        {images.length > 1 && (
          <div className="absolute top-4 left-4 z-50 text-white/80 text-sm font-medium bg-black/40 px-3 py-1 rounded-full">
            {currentIndex + 1} / {images.length}
          </div>
        )}

        {/* Previous button */}
        {images.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevious}
            className="absolute left-2 sm:left-4 z-50 text-white hover:bg-white/20 rounded-full w-10 h-10 sm:w-12 sm:h-12"
          >
            <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
          </Button>
        )}

        {/* Image */}
        <div
          className="w-full h-full flex items-center justify-center p-4 sm:p-8"
          onClick={() => setIsZoomed(!isZoomed)}
        >
          <img
            src={images[currentIndex]}
            alt={`Image ${currentIndex + 1}`}
            className={`max-w-full max-h-full object-contain transition-transform duration-300 ease-out ${
              isZoomed ? "scale-150 cursor-zoom-out" : "scale-100 cursor-zoom-in"
            } ${open ? "animate-in zoom-in-95 fade-in duration-200" : ""}`}
            draggable={false}
          />
        </div>

        {/* Next button */}
        {images.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNext}
            className="absolute right-2 sm:right-4 z-50 text-white hover:bg-white/20 rounded-full w-10 h-10 sm:w-12 sm:h-12"
          >
            <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImageLightbox;
