import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, createRoute, createRouter, lazyRouteComponent, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { EditionId } from "@/contracts";
import { sessionStore } from "@/lib/session/session-store";
import { featuredQuery, nftDetailQuery, nftListQuery } from "@/features/catalog/queries";
import { toListParams, validateCatalogSearch } from "@/features/catalog/search";
import { HomePage } from "@/features/catalog/home-page";
import { AuthGate } from "@/features/auth/auth-gate";
import { RootLayout } from "./root-layout";
import { NotFoundPage, RouteErrorPage } from "./status-pages";

export interface RouterContext {
  queryClient: QueryClient;
}

/** Layout global: quais partes do "chrome" cada rota exibe. */
export interface RouteChrome {
  /** Barra de navegação inferior no mobile. */
  mobileNav?: boolean;
  /** Rodapé: em todas as larguras, só a partir do tablet, ou nunca. */
  footer?: "all" | "desktop" | "none";
  /** Cabeçalho desktop (o mobile usa barras próprias por tela). */
  header?: boolean;
}

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    chrome?: RouteChrome;
  }
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

/** Evita open redirect: só caminhos internos. */
export function safeRedirect(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : undefined;
}

export interface AuthSearch {
  redirect?: string;
  motivo?: "expirada";
}

const authSearch = (search: Record<string, unknown>): AuthSearch => ({
  redirect: safeRedirect(search.redirect),
  motivo: z.enum(["expirada"]).optional().catch(undefined).parse(search.motivo),
});

function requireAuth({ location }: { location: { href: string } }) {
  if (sessionStore.get().status !== "authenticated") {
    throw redirect({ to: "/entrar", search: { redirect: location.href } });
  }
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorPage,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: validateCatalogSearch,
  loaderDeps: ({ search }) => toListParams(search),
  // Pré-busca sem bloquear a navegação: a página exibe skeletons enquanto carrega.
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(nftListQuery(deps));
    void context.queryClient.prefetchQuery(featuredQuery());
  },
  component: HomePage,
  staticData: { chrome: { mobileNav: true, footer: "all" } },
});

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/nft/$nftId",
  validateSearch: (search: Record<string, unknown>): { edicao?: EditionId } => ({
    edicao: EditionId.optional().catch(undefined).parse(search.edicao),
  }),
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftDetailQuery(params.nftId));
  },
  component: lazyRouteComponent(() => import("@/features/nft/nft-detail-page"), "NftDetailPage"),
  staticData: { chrome: { footer: "desktop" } },
});

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/carrinho",
  component: lazyRouteComponent(() => import("@/features/cart/cart-page"), "CartPage"),
  staticData: { chrome: { footer: "desktop" } },
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/entrar",
  validateSearch: authSearch,
  component: lazyRouteComponent(() => import("@/features/auth/auth-route"), "LoginRoute"),
  staticData: { chrome: { footer: "none" } },
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cadastro",
  validateSearch: authSearch,
  component: lazyRouteComponent(() => import("@/features/auth/auth-route"), "RegisterRoute"),
  staticData: { chrome: { footer: "none" } },
});

const comingSoonPage = lazyRouteComponent(() => import("./status-pages"), "ComingSoonPage");

const creatorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/criadores",
  component: comingSoonPage,
  staticData: { chrome: { mobileNav: true, footer: "all" } },
});

const learnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/aprenda",
  component: comingSoonPage,
  staticData: { chrome: { mobileNav: true, footer: "all" } },
});

/* ------------------------------- área privada ------------------------------ */

const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authed",
  beforeLoad: requireAuth,
  component: AuthGate,
});

const checkoutRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/pagamento",
  component: lazyRouteComponent(() => import("@/features/checkout/checkout-page"), "CheckoutPage"),
  staticData: { chrome: { footer: "desktop" } },
});

const orderRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/pedidos/$orderId",
  component: lazyRouteComponent(() => import("@/features/orders/order-page"), "OrderPage"),
  staticData: { chrome: { header: false, footer: "none" } },
});

const profileLayoutRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/perfil",
  component: lazyRouteComponent(() => import("@/features/account/account-layout"), "AccountLayout"),
  staticData: { chrome: { mobileNav: true, footer: "none" } },
});

const profileRoute = createRoute({
  getParentRoute: () => profileLayoutRoute,
  path: "/",
  component: lazyRouteComponent(() => import("@/features/account/profile-page"), "ProfilePage"),
  staticData: { chrome: { mobileNav: true, footer: "none" } },
});

const walletsRoute = createRoute({
  getParentRoute: () => profileLayoutRoute,
  path: "/carteiras",
  component: lazyRouteComponent(() => import("@/features/account/wallets-page"), "WalletsPage"),
  staticData: { chrome: { mobileNav: true, footer: "none" } },
});

const favoritesRoute = createRoute({
  getParentRoute: () => profileLayoutRoute,
  path: "/lista-de-interesse",
  component: lazyRouteComponent(() => import("@/features/account/favorites-page"), "FavoritesPage"),
  staticData: { chrome: { mobileNav: true, footer: "none" } },
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  nftRoute,
  cartRoute,
  loginRoute,
  registerRoute,
  creatorsRoute,
  learnRoute,
  authedRoute.addChildren([checkoutRoute, orderRoute, profileLayoutRoute.addChildren([profileRoute, walletsRoute, favoritesRoute])]),
]);

/* --------------------------- serialização da URL --------------------------- */

function parseSearch(searchStr: string) {
  return Object.fromEntries(new URLSearchParams(searchStr));
}

function stringifySearch(search: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === "") continue;
    // Arrays viram listas separadas por vírgula (Array#toString).
    params.set(key, String(value));
  }
  const text = params.toString().replace(/%2C/g, ",");
  return text ? `?${text}` : "";
}

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    parseSearch,
    stringifySearch,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultNotFoundComponent: NotFoundPage,
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
