"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { CatalogSearch } from "./search";
import { NftImage } from "@/components/shared/nft-image";
import { Button } from "@/components/ui/button";
import { useIsDesktop } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

interface Slide {
  eyebrow: string;
  title: [string, string];
  mobileTitle: [string, string];
  text: string;
  mobileText: string;
  image: { src: string; alt: string };
  secondary: { src: string; alt: string };
  search: CatalogSearch;
}

const SLIDES: Slide[] = [
  {
    eyebrow: "Bem-vindo à Kurio",
    title: ["SEJA DONO DO FUTURO", "DA ARTE DIGITAL"],
    mobileTitle: ["SEJA DONO DA", "CULTURA DIGITAL"],
    text: "Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.",
    mobileText: "Descubra NFTs selecionados de criadores do mundo todo.",
    image: { src: "/nfts/emerald-ape.png", alt: "Emerald Ape #042 — macaco com óculos redondos e jaqueta college verde" },
    secondary: { src: "/nfts/sage-nomad.png", alt: "" },
    search: {},
  },
  {
    eyebrow: "Lançamentos gênesis",
    title: ["EDIÇÕES LIMITADAS", "DIRETO DOS CRIADORES"],
    mobileTitle: ["EDIÇÕES", "LIMITADAS"],
    text: "Colecione edições escassas diretamente dos criadores antes da revelação pública, com procedência registrada na rede.",
    mobileText: "Colecione edições escassas antes da revelação pública.",
    image: { src: "/nfts/golden-beat.png", alt: "Golden Beat #207 — orangotango dourado com fones de ouvido verdes" },
    secondary: { src: "/nfts/ivory-baron.png", alt: "" },
    search: { aba: "novos" },
  },
  {
    eyebrow: "Coleções verificadas",
    title: ["ARTE DIGITAL", "COM PROCEDÊNCIA"],
    mobileTitle: ["ARTE COM", "PROCEDÊNCIA"],
    text: "Explore novos artistas, coleções verificadas e obras digitais que definem a cultura — com contratos auditados e metadados imutáveis.",
    mobileText: "Coleções verificadas e metadados imutáveis.",
    image: { src: "/nfts/ivory-baron.png", alt: "Ivory Baron #088 — chimpanzé de blazer bege e gola alta verde" },
    secondary: { src: "/nfts/golden-beat.png", alt: "" },
    search: { categoria: ["arte-digital"] },
  },
];

function Dots({ index, onSelect, className }: { index: number; onSelect: (i: number) => void; className?: string }) {
  return (
    <div className={cn("flex gap-1.5", className)}>
      {SLIDES.map((slide, i) => (
        <button
          key={slide.eyebrow}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`Mostrar destaque ${i + 1} de ${SLIDES.length}: ${slide.eyebrow}`}
          aria-current={i === index ? "true" : undefined}
          className={cn("size-2.5 rounded-full bg-primary transition-opacity", i === index ? "opacity-100" : "opacity-60 hover:opacity-90")}
        />
      ))}
    </div>
  );
}

/** Carrossel de destaques (sem rotação automática, controlado pelos pontos). */
export function Hero() {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index]!;
  const desktop = useIsDesktop();

  return (
    <section aria-roledescription="carrossel" aria-label="Destaques da Kurio" className="container-page">
      {desktop ? (
        <div
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} de ${SLIDES.length}`}
          className="relative grid grid-cols-[1fr_minmax(0,24rem)] items-center gap-8 pt-6 lg:grid-cols-[1fr_minmax(0,28rem)]"
        >
          <div className="flex flex-col gap-4 pb-10 lg:pl-8">
            <p className="text-xs font-medium">{slide.eyebrow}</p>
            <h1 className="text-[1.9rem] leading-[1.45] font-bold tracking-wide lg:text-[2.6rem]">
              {slide.title[0]}
              <br />
              {slide.title[1]}
            </h1>
            <p className="max-w-[34rem] text-xs leading-relaxed text-muted-foreground lg:text-[0.8rem]">{slide.text}</p>
            <Button asChild className="mt-4 h-10 w-fit px-7 text-xs">
              <Link to="/" search={slide.search} hash="catalogo">
                EXPLORAR
              </Link>
            </Button>
          </div>
          <NftImage
            image={slide.image}
            sizes="(min-width: 1024px) 448px, 384px"
            priority={index === 0}
            className="aspect-[45/49] rounded-3xl"
          />
          <Dots index={index} onSelect={setIndex} className="absolute right-[calc(min(28rem,40%)+2.5rem)] bottom-6" />
        </div>
      ) : (
        <div
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} de ${SLIDES.length}`}
          className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#6c4528] via-[#4a2f1d] to-[#2a1b13] px-5 pt-4 pb-9"
        >
          <span aria-hidden className="absolute -top-16 left-24 size-80 rounded-full bg-white/[0.05]" />
          <span aria-hidden className="absolute top-12 -left-20 size-72 rounded-full bg-white/[0.04]" />
          <div className="relative flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-xs font-medium">{slide.eyebrow}</p>
              <h1 className="text-[1.05rem] leading-[1.6] font-bold tracking-wide">
                {slide.mobileTitle[0]}
                <br />
                {slide.mobileTitle[1]}
              </h1>
              <p className="text-xs leading-relaxed text-foreground/80">{slide.mobileText}</p>
              <Link
                to="/"
                search={slide.search}
                hash="catalogo"
                className="mt-1 inline-flex items-center gap-2 text-sm font-bold text-price"
              >
                EXPLORAR <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="relative mt-2 w-[40%] shrink-0">
              <NftImage image={slide.image} sizes="40vw" priority={index === 0} className="aspect-square rounded-2xl" />
              <NftImage
                image={slide.secondary}
                sizes="20vw"
                decorative
                className="absolute -bottom-3 -left-3 aspect-square w-[42%] rounded-xl border-2 border-[#3a2618]"
              />
            </div>
          </div>
          <Dots index={index} onSelect={setIndex} className="absolute bottom-3 left-1/2 -translate-x-1/2" />
        </div>
      )}
    </section>
  );
}
