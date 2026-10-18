import type { Clothing } from "@/types";
import { DeleteOverlayButton } from "@/components/kit/buttons";
import { TileCaption } from "@/components/kit/tiles";

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
              <DeleteOverlayButton label={`Remove ${item.name}`} onClick={() => onRemove(item)} />
              {item.path && <img src={item.path} alt={item.name} className="h-full w-full object-cover" />}
            </div>
            <TileCaption className="text-xs">{item.name}</TileCaption>
          </div>
        ))}
      </div>
    </div>
  );
}
