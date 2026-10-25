import { Link } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import { Button } from "@/components/ui/button";

export function NftNotFound() {
  return (
    <>
      <MobileTopBar title="NFT" />
      <div className="container-page flex min-h-[55dvh] flex-col items-center justify-center gap-4 py-16 text-center">
        <SearchX className="size-10 text-primary" aria-hidden />
        <h1 className="text-2xl font-bold">NFT não encontrado</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Este NFT não existe, foi removido ou o endereço está incorreto. Explore o catálogo para encontrar outras obras.
        </p>
        <Button asChild>
          <Link to="/" hash="catalogo">
            Explorar o catálogo
          </Link>
        </Button>
      </div>
    </>
  );
}
