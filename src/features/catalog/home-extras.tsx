"use client";

import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { NftImage } from "@/components/shared/nft-image";
import { notAvailable } from "@/components/shared/misc";
import { Button } from "@/components/ui/button";
import type { CatalogSearch } from "./search";

const BANNERS: Array<{ title: [string, string]; text: string; image: string; search: CatalogSearch }> = [
  {
    title: ["Lançamentos gênesis", "de edição limitada"],
    text: "Colecione edições escassas diretamente dos criadores antes da revelação pública.",
    image: "/nfts/emerald-ape.png",
    search: { aba: "novos" },
  },
  {
    title: ["Arte digital selecionada", "e muito mais"],
    text: "Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.",
    image: "/nfts/ivory-baron.png",
    search: { categoria: ["arte-digital"] },
  },
];

export function PromoBanners() {
  return (
    <section aria-label="Coleções em destaque" className="container-page grid gap-5 pt-16 md:grid-cols-2 md:pt-24">
      {BANNERS.map((banner) => (
        <article
          key={banner.title[0]}
          className="grid min-h-44 grid-cols-[minmax(0,45%)_minmax(0,1fr)] overflow-hidden rounded-r-md bg-card"
        >
          <NftImage
            image={{ src: banner.image, alt: "" }}
            decorative
            sizes="(min-width: 768px) 260px, 45vw"
            className="h-full min-h-44 rounded-2xl"
          />
          <div className="flex flex-col items-end justify-center gap-3 p-4 text-right">
            <h2 className="text-sm leading-snug font-bold">
              {banner.title[0]}
              <br />
              {banner.title[1]}
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">{banner.text}</p>
            <Button asChild size="sm" className="h-8 px-6">
              <Link to="/" search={banner.search} hash="catalogo" aria-label={`Explorar ${banner.title.join(" ")}`}>
                Explorar <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}

const POSTS = [
  {
    date: "12 de setembro",
    read: "6 min",
    title: "Como funciona a propriedade de NFTs",
    text: "Aprenda a colecionar, negociar e verificar ativos digitais.",
    image: "/nfts/ivory-baron.png",
  },
  {
    date: "13 de setembro",
    read: "2 min",
    title: "10 artistas digitais para acompanhar",
    text: "Conheça criadores que moldam a cultura digital.",
    image: "/nfts/emerald-ape.png",
  },
  {
    date: "15 de setembro",
    read: "3 min",
    title: "Raridade, atributos e procedência",
    text: "Entenda raridade, procedência, direitos autorais e utilidade.",
    image: "/nfts/sage-nomad.png",
  },
  {
    date: "15 de setembro",
    read: "2 min",
    title: "Como proteger sua carteira",
    text: "Proteja sua carteira, seus ativos e sua identidade.",
    image: "/nfts/golden-beat.png",
  },
];

export function JournalSection() {
  return (
    <section aria-labelledby="diario-title" className="container-page pt-16 md:pt-24">
      <div className="mb-8 text-center">
        <h2 id="diario-title" className="text-2xl font-bold">
          Diário da Cunhagem
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <li key={post.title}>
            <article className="flex h-full flex-col bg-card">
              <NftImage
                image={{ src: post.image, alt: "" }}
                decorative
                sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 90vw"
                className="aspect-[23/17]"
              />
              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="text-xs text-muted-foreground">
                  {post.date} <span aria-hidden>|</span> Leitura de {post.read}
                </p>
                <h3 className="text-sm leading-snug font-bold">{post.title}</h3>
                <p className="flex-1 text-xs leading-relaxed text-muted-foreground">{post.text}</p>
                <button
                  type="button"
                  onClick={() => notAvailable("O Diário da Cunhagem")}
                  className="w-fit text-xs font-bold text-primary hover:underline"
                  aria-label={`Ler mais: ${post.title}`}
                >
                  Ler mais →
                </button>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
