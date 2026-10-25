import Head from "next/head";
import { ClientApp } from "@/app-shell/client-app";

const TITLE = "Kurio — Marketplace de NFTs e arte digital";
const DESCRIPTION =
  "Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.";

/**
 * Todas as URLs caem nesta página (catch-all, pré-renderizada estaticamente).
 * O Next.js entrega o documento, fontes, metadados e imagens otimizadas; o
 * TanStack Router assume o roteamento no cliente — search params, guards e 404.
 */
export default function Page() {
  return (
    <>
      <Head>
        <title>{TITLE}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:site_name" content="Kurio" />
        <meta property="og:title" content="Kurio — Seja dono do futuro da arte digital" />
        <meta property="og:description" content="Marketplace de NFTs com coleções verificadas e lançamentos de edição limitada." />
        <meta property="og:image" content="/nfts/emerald-ape.png" />
      </Head>
      <ClientApp />
    </>
  );
}
