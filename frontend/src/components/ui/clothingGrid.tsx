import type { Clothing } from "@/types";

interface ClothingGridInputProps {
  label?: string;
  value: Clothing[];
  onRemove: (item: Clothing) => void;
}

export function ClothingGrid({ label, value, onRemove }: ClothingGridInputProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {label && <h2 className="text-lg font-medium">{label}</h2>}
      <div className="grid auto-rows-min grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 md:gap-5">
        {value.map((item) => (
          <div key={item.id} className="group flex flex-col gap-1">
            <div className="relative aspect-square overflow-hidden border border-border/60 bg-muted/40">
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                onClick={() => onRemove(item)}
                className="absolute top-1 right-1 z-10 bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
              {item.path && <img src={item.path} alt={item.name} className="h-full w-full object-cover" />}
            </div>
            <p className="truncate text-xs text-muted-foreground">{item.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
