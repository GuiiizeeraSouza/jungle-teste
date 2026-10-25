"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, Mail, Search, ShoppingCart, Star } from "lucide-react";
import { toast } from "sonner";
import { NETWORK_LABEL, type Edition, type NftDetail } from "@/contracts";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { BackButton } from "@/components/layout/mobile-top-bar";
import { LinkedinIcon, TwitterIcon } from "@/components/shared/brand-icons";
import { Rating, shortAddress } from "@/components/shared/misc";
import { NftImage } from "@/components/shared/nft-image";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAddToCart, useQuantityInCart } from "@/features/cart/use-cart";
import { nftDetailQuery } from "@/features/catalog/queries";
import { useIsFavorite, useToggleFavorite } from "@/features/favorites/use-favorites";
import { toApiError } from "@/lib/api/errors";
import { formatEth } from "@/lib/eth";
import { useIsDesktop } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { MoreFromCollection } from "./more-from-collection";
import { NftDetailSkeleton } from "./nft-detail-skeleton";
import { NftNotFound } from "./nft-not-found";
import { ReviewsPanel } from "./reviews-panel";

function pickEdition(nft: NftDetail, requested?: string): Edition {
  const byId = (id?: string) => nft.editions.find((e) => e.id === id);
  return byId(requested) ?? byId(nft.defaultEditionId) ?? nft.editions[0]!;
}

/** Detecta mudanças de preço/disponibilidade vindas do tempo real. */
function useLiveChange(edition: Edition) {
  const previous = useRef({ id: edition.id, price: edition.price, available: edition.available });
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const prev = previous.current;
    previous.current = { id: edition.id, price: edition.price, available: edition.available };
    if (prev.id !== edition.id) return setMessage(null);
    if (prev.price !== edition.price) setMessage(`Preço atualizado agora: de ${formatEth(prev.price)} para ${formatEth(edition.price)}`);
    else if (prev.available !== edition.available)
      setMessage(edition.available === 0 ? "Esta edição acabou de esgotar" : `Disponibilidade atualizada: restam ${edition.available}`);
  }, [edition.id, edition.price, edition.available]);
  return message;
}

function EditionPicker({ nft, selected, onSelect }: { nft: NftDetail; selected: Edition; onSelect: (id: Edition["id"]) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold">Edição:</legend>
      <div role="radiogroup" aria-label="Edição" className="flex flex-wrap gap-2">
        {nft.editions.map((edition) => {
          const active = edition.id === selected.id;
          const soldOut = edition.available === 0;
          return (
            <button
              key={edition.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-disabled={soldOut || undefined}
              aria-label={`${edition.label}, ${formatEth(edition.price)}${soldOut ? ", esgotada" : `, ${edition.available} disponíveis`}`}
              onClick={() => !soldOut && onSelect(edition.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors md:px-2.5 md:py-0.5",
                active ? "border-primary font-bold text-primary" : "border-border text-foreground/90 hover:border-primary/60",
                soldOut && "cursor-not-allowed text-foreground/40 line-through",
              )}
            >
              {edition.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {selected.available === 0
          ? "Edição esgotada — escolha outra edição."
          : `${selected.available} de ${selected.supply} disponíveis · máximo de ${selected.maxPerOrder} por pedido`}
      </p>
    </fieldset>
  );
}

function ShareLinks({ nft }: { nft: NftDetail }) {
  const url = typeof window !== "undefined" ? window.location.href : "";
  const text = `${nft.name} na Kurio`;
  const links = [
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, Icon: LinkedinIcon },
    { label: "e-mail", href: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`, Icon: Mail },
    {
      label: "Twitter",
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      Icon: TwitterIcon,
    },
  ];
  return (
    <div className="flex items-center gap-2 text-sm font-bold">
      Compartilhar este NFT:
      {links.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          target={href.startsWith("mailto") ? undefined : "_blank"}
          rel="noopener noreferrer"
          aria-label={`Compartilhar por ${label}${href.startsWith("mailto") ? "" : " (abre em nova aba)"}`}
          className="grid size-6 place-items-center hover:text-primary"
        >
          <Icon className="size-4" />
        </a>
      ))}
    </div>
  );
}

function Gallery({ nft }: { nft: NftDetail }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const item = nft.gallery[active] ?? nft.gallery[0]!;
  return (
    <div className="flex gap-4">
      <div role="tablist" aria-label="Galeria" aria-orientation="vertical" className="flex w-16 shrink-0 flex-col gap-3 lg:w-[4.5rem]">
        {nft.gallery.map((g, i) => (
          <button
            key={`${g.focus}-${i}`}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={`Ver imagem ${i + 1} de ${nft.gallery.length}: ${g.alt}`}
            onClick={() => setActive(i)}
            className={cn(
              "overflow-hidden rounded-[4px] border-2 transition-colors",
              i === active ? "border-primary" : "border-transparent hover:border-primary/50",
            )}
          >
            <NftImage image={g} focus={g.focus} sizes="72px" decorative className="aspect-square" />
          </button>
        ))}
      </div>
      <div className="relative flex-1 bg-card p-3">
        <NftImage image={item} focus={item.focus} sizes="(min-width: 1024px) 420px, 40vw" priority className="aspect-square rounded-2xl" />
        <button
          type="button"
          onClick={() => setZoom(true)}
          aria-label="Ampliar imagem"
          className="absolute top-4 right-4 grid size-8 place-items-center rounded-full bg-[#1c120e]/70 text-foreground hover:text-primary"
        >
          <Search className="size-4" aria-hidden />
        </button>
      </div>
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-[min(90vw,46rem)] p-3 sm:max-w-[min(90vw,46rem)]">
          <DialogTitle className="sr-only">{nft.name}</DialogTitle>
          <DialogDescription className="sr-only">{item.alt}</DialogDescription>
          <NftImage image={item} focus={item.focus} sizes="(min-width: 768px) 46rem, 90vw" className="aspect-square rounded-xl" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailsTab({ nft }: { nft: NftDetail }) {
  return (
    <div className="flex flex-col gap-4 text-xs leading-relaxed">
      {nft.longDescription.map((p) => (
        <p key={p.slice(0, 24)} className="text-muted-foreground">
          {p}
        </p>
      ))}
      <dl className="flex flex-col gap-3">
        <div>
          <dt className="font-bold">Rede:</dt>
          <dd className="text-muted-foreground">
            Cunhado na {NETWORK_LABEL[nft.network]} com procedência imutável e metadados armazenados no {nft.storage}.
          </dd>
        </div>
        <div>
          <dt className="font-bold">Contrato:</dt>
          <dd className="text-muted-foreground">
            <span title={nft.contractAddress}>{shortAddress(nft.contractAddress).replace("…", "...")}</span> • Contrato inteligente{" "}
            {nft.contractStandard} verificado.
          </dd>
        </div>
        <div>
          <dt className="font-bold">Direitos autorais:</dt>
          <dd className="text-muted-foreground">
            Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.
          </dd>
        </div>
      </dl>
    </div>
  );
}

function PurchasePanel({ nft }: { nft: NftDetail }) {
  const search = useSearch({ from: "/nft/$nftId" });
  const navigate = useNavigate({ from: "/nft/$nftId" });
  const desktop = useIsDesktop();
  const edition = pickEdition(nft, search.edicao);
  const inCart = useQuantityInCart(nft.id, edition.id);
  const limit = Math.max(0, Math.min(edition.available, edition.maxPerOrder) - inCart);
  const [quantity, setQuantity] = useState(1);
  const addToCart = useAddToCart();
  const favorites = useToggleFavorite();
  const favorite = useIsFavorite(nft.id);
  const liveMessage = useLiveChange(edition);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => setQuantity((q) => Math.max(1, Math.min(q, limit || 1))), [limit, edition.id]);

  const soldOut = edition.available === 0;
  const blocked = soldOut || limit === 0;
  const blockedReason = soldOut ? "Edição esgotada" : limit === 0 ? `Você já tem o máximo desta edição no carrinho (${inCart})` : null;

  const add = (goToCart: boolean) => {
    setFormError(null);
    addToCart.mutate(
      { nftId: nft.id, editionId: edition.id, quantity },
      {
        onSuccess: () => {
          if (goToCart) void navigate({ to: "/carrinho" });
        },
        onError: (error) => {
          const message = toApiError(error).message;
          setFormError(message);
          toast.error("Não foi possível adicionar ao carrinho", { description: message });
        },
      },
    );
  };

  const selectEdition = (id: Edition["id"]) => {
    setFormError(null);
    void navigate({ search: { edicao: id === nft.defaultEditionId ? undefined : id }, replace: true, resetScroll: false });
  };

  const priceBlock = (
    <div aria-live="polite" aria-atomic="true">
      <p className="text-price" data-testid="detail-price">
        <span className="sr-only">Preço da edição {edition.label}: </span>
        {formatEth(edition.price)}
      </p>
      {liveMessage && (
        <p className="mt-1 text-xs font-medium text-warning" data-testid="live-price-change">
          {liveMessage}
        </p>
      )}
    </div>
  );

  const info = (
    <ul className="flex flex-col gap-2 text-xs text-muted-foreground md:text-xs">
      <li>ID do token: {nft.tokenId}</li>
      <li>Coleção: {nft.collection}</li>
      <li>Atributos: {nft.attributes.join(", ")}</li>
    </ul>
  );

  if (desktop) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">{nft.name}</h1>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
          <div className="text-xl font-bold">{priceBlock}</div>
          <p className="flex items-center gap-2 text-xs">
            <Rating value={nft.rating} />
            {nft.reviewCount} avaliações de colecionadores
          </p>
        </div>
        <h2 className="text-xs font-bold">Sobre este NFT:</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">{nft.description}</p>
        <EditionPicker nft={nft} selected={edition} onSelect={selectEdition} />
        <div className="flex flex-wrap items-center justify-between gap-3 py-1">
          <QuantityStepper
            value={quantity}
            max={Math.max(1, limit)}
            onChange={setQuantity}
            label="Quantidade"
            disabled={blocked}
            size="md"
            className="[&_button]:size-7"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => add(true)}
              disabled={blocked || addToCart.isPending}
              className="h-8 px-7 text-xs"
              data-testid="buy-button"
            >
              {addToCart.isPending ? "ADICIONANDO…" : "COMPRAR"}
            </Button>
            <Button
              variant="outline"
              onClick={() => favorites.toggle(nft.id, nft.name, !favorite)}
              aria-pressed={favorite}
              className="h-8 text-xs font-medium"
            >
              <Heart className={cn(favorite && "fill-current")} aria-hidden />
              {favorite ? "Favoritado" : "Favoritar"}
            </Button>
          </div>
        </div>
        {(blockedReason || formError) && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {formError ?? blockedReason}
          </p>
        )}
        {info}
        <ShareLinks nft={nft} />
      </div>
    );
  }

  return (
    <>
      <div className="relative -mt-12 rounded-t-[2rem] bg-card px-6 pt-8 pb-40">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl leading-tight font-bold">{nft.name}</h1>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary px-2.5 py-1 text-base">
            <Star className="size-4 fill-primary text-primary" aria-hidden />
            <span className="sr-only">Avaliação</span>
            {nft.rating.toFixed(1)}
            <span className="text-muted-foreground">({nft.reviewCount})</span>
          </span>
        </div>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Um colecionável digital {edition.label === "ABERTA" ? "de edição aberta" : edition.label} finalizado à mão da coleção Kurio
          Editions, verificado na {NETWORK_LABEL[nft.network]}.
        </p>
        <div className="mt-4 [&_button]:text-base">
          <EditionPicker nft={nft} selected={edition} onSelect={selectEdition} />
        </div>
        <div className="mt-4 text-base [&_ul]:gap-3 [&_ul]:text-base">{info}</div>
        <div className="mt-6">
          <MoreFromCollection nft={nft} />
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-[2rem] bg-[#22170f] px-6 pt-5 pb-6 shadow-[0_-8px_24px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-base font-bold">
            Qtd.
            <QuantityStepper
              value={quantity}
              max={Math.max(1, limit)}
              onChange={setQuantity}
              label="Quantidade"
              disabled={blocked}
              size="md"
              className="[&_button]:h-8 [&_button]:w-7"
            />
          </div>
          <div className="text-right text-2xl font-bold">{priceBlock}</div>
        </div>
        {(blockedReason || formError) && (
          <p role="alert" className="mt-2 text-xs font-medium text-destructive">
            {formError ?? blockedReason}
          </p>
        )}
        <div className="mt-4 flex gap-4">
          <Button
            variant="pill"
            size="xl"
            className="flex-1"
            onClick={() => add(true)}
            disabled={blocked || addToCart.isPending}
            data-testid="buy-button"
          >
            {addToCart.isPending ? "Adicionando…" : "Comprar NFT"}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="size-14 rounded-full bg-surface-strong text-price"
            onClick={() => add(false)}
            disabled={blocked || addToCart.isPending}
            aria-label="Adicionar ao carrinho"
          >
            <ShoppingCart className="size-5" aria-hidden />
          </Button>
        </div>
      </div>
    </>
  );
}

export function NftDetailPage() {
  const { nftId } = useParams({ from: "/nft/$nftId" });
  const desktop = useIsDesktop();
  const query = useQuery(nftDetailQuery(nftId));
  // Conteúdo renderizado em prioridade de transição (fatiada).
  const deferred = useDeferredValue(query.data);
  const favorites = useToggleFavorite();
  const favorite = useIsFavorite(nftId);

  if (query.isPending || (query.data && !deferred)) return <NftDetailSkeleton />;
  if (query.error && !query.data) {
    if (toApiError(query.error).isNotFound) return <NftNotFound />;
    return (
      <div className="container-page py-12">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
      </div>
    );
  }
  const nft = deferred ?? query.data!;

  if (!desktop) {
    return (
      <article aria-label={nft.name} className="min-h-dvh bg-[#1a110d]">
        <div className="relative px-6 pt-20">
          <div className="absolute inset-x-6 top-6 z-10 flex justify-between">
            <BackButton fallback="/" />
            <button
              type="button"
              onClick={() => favorites.toggle(nft.id, nft.name, !favorite)}
              aria-pressed={favorite}
              aria-label={favorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
              className="grid size-11 place-items-center rounded-full bg-surface-strong text-primary"
            >
              <Heart className={cn("size-5", favorite && "fill-current")} aria-hidden />
            </button>
          </div>
          <NftImage image={nft.image} sizes="100vw" priority className="aspect-[63/62] rounded-3xl" />
        </div>
        <PurchasePanel nft={nft} />
      </article>
    );
  }

  return (
    <article className="container-page flex flex-col gap-14 pt-6" aria-label={nft.name}>
      <div className="flex flex-col gap-3">
        <Breadcrumbs items={[{ label: "Início", to: "/" }, { label: "Mercado", to: "/", hash: "catalogo" }, { label: nft.name }]} />
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Gallery nft={nft} />
          <PurchasePanel nft={nft} />
        </div>
      </div>

      <Tabs defaultValue="detalhes">
        <TabsList aria-label="Informações do NFT">
          <TabsTrigger value="detalhes">Detalhes do NFT</TabsTrigger>
          <TabsTrigger value="avaliacoes">Avaliações de colecionadores ({nft.reviewCount})</TabsTrigger>
        </TabsList>
        <TabsContent value="detalhes">
          <DetailsTab nft={nft} />
        </TabsContent>
        <TabsContent value="avaliacoes">
          <ReviewsPanel nftId={nft.id} />
        </TabsContent>
      </Tabs>

      <MoreFromCollection nft={nft} />
    </article>
  );
}
