import React from "react";

interface GalleryGridProps {
  urls: string[];
  maxVisible?: number;
}

const GalleryGrid: React.FC<GalleryGridProps> = ({ urls, maxVisible = 4 }) => {
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

  return (
    <div className="mb-2 w-[300px] max-w-full max-h-[400px] overflow-hidden rounded-lg">
      <div className={gridClassName}>
        {visible.map((url, index) => {
          const isLastVisible = index === visible.length - 1;
          const showOverflow = overflow > 0 && isLastVisible;

          return (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => window.open(url, "_blank")}
              className={`${getTileClassName(index)} block w-full aspect-square overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
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
  );
};

export default GalleryGrid;
