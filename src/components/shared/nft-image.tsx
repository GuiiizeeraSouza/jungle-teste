import Image from "next/image";
import type { GalleryItem, ImageRef } from "@/contracts";
import { cn } from "@/lib/utils";

const FOCUS: Record<GalleryItem["focus"], { scale: number; origin: string }> = {
  full: { scale: 1, origin: "50% 50%" },
  face: { scale: 1.75, origin: "58% 40%" },
  detail: { scale: 2.1, origin: "55% 82%" },
  torso: { scale: 1.5, origin: "50% 95%" },
};

interface NftImageProps {
  image: ImageRef;
  focus?: GalleryItem["focus"];
  sizes: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  /** Imagens decorativas (o nome do NFT já está no texto ao lado). */
  decorative?: boolean;
}

/** Arte do NFT com proporção preservada (sem deslocamento de layout). */
export function NftImage({ image, focus = "full", sizes, priority, className, imageClassName, decorative }: NftImageProps) {
  const { scale, origin } = FOCUS[focus];
  return (
    <div className={cn("relative overflow-hidden bg-[#ede3c9]", className)}>
      <Image
        src={image.src}
        alt={decorative ? "" : image.alt}
        fill
        sizes={sizes}
        preload={priority}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        className={cn("object-cover transition-transform duration-500", imageClassName)}
        style={{ transform: scale === 1 ? undefined : `scale(${scale})`, transformOrigin: origin }}
      />
    </div>
  );
}
