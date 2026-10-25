"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ChevronDown, EllipsisVertical, Loader2, PlugZap, Unplug, Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";
import {
  NETWORK_LABEL,
  Network,
  WALLET_TYPE_LABEL,
  WalletType,
  type CreateOrderInput,
  type Quote,
  type User,
  type Wallet,
  type WalletConnection,
  type WalletsResponse,
} from "@/contracts";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import { WalletsChip } from "@/components/layout/site-footer";
import { FormAlert, FormField } from "@/components/shared/form-field";
import { shortAddress } from "@/components/shared/misc";
import { NftImage } from "@/components/shared/nft-image";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CouponForm, SummaryRows, SummarySkeleton } from "@/features/cart/price-summary";
import { useCart, useCartOwner } from "@/features/cart/use-cart";
import { useCurrentUser } from "@/features/session/use-session";
import { toApiError } from "@/lib/api/errors";
import { announce } from "@/lib/announce";
import { formatEth } from "@/lib/eth";
import { applyServerErrors, zodResolver } from "@/lib/forms";
import { qk } from "@/lib/query/keys";
import { checkoutStorage, type CheckoutAttempt } from "@/lib/session/checkout-storage";
import { ordersApi } from "@/lib/api/endpoints";
import { useIsDesktop } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import {
  CHECKOUT_FIELDS,
  CheckoutFormSchema,
  emptyDefaults,
  toBuyer,
  walletDefaults,
  type CheckoutFormValues,
  type WalletChoice,
} from "./checkout-schema";
import { ReviewDialog } from "./review-dialog";
import {
  quoteFromError,
  useConnectWallet,
  useDisconnectWallet,
  useFetchQuote,
  usePendingOrders,
  usePlaceOrder,
  useQuote,
  useWallets,
} from "./use-checkout";

/* -------------------------------------------------------------------------- */
/* Peças visuais                                                              */
/* -------------------------------------------------------------------------- */

function RadioMark({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden className="grid size-4 shrink-0 place-items-center rounded-full border border-primary">
      {checked && <span className="size-2 rounded-full bg-primary" />}
    </span>
  );
}

interface RadioCardProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
  className?: string;
  markPosition?: "start" | "end";
  testId?: string;
}

/** Card de rádio acessível (input nativo, foco visível no card). */
function RadioCard({ name, value, checked, onChange, children, className, markPosition = "start", testId }: RadioCardProps) {
  return (
    <label
      data-testid={testId}
      className={cn(
        "relative flex cursor-pointer items-center gap-3 border transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/60",
        checked ? "border-primary" : "border-border hover:border-primary/50",
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="absolute inset-0 z-[1] size-full cursor-pointer appearance-none opacity-0"
      />
      {markPosition === "start" && <RadioMark checked={checked} />}
      <span className="min-w-0 flex-1">{children}</span>
      {markPosition === "end" && <RadioMark checked={checked} />}
    </label>
  );
}

const PROVIDER_BADGE: Record<WalletType, React.ReactNode> = {
  walletconnect: "W",
  metamask: "M",
  coinbase: <WalletIcon className="size-5" aria-hidden />,
};

function walletLabel(wallet: Wallet) {
  return wallet.slot === "primary" ? "Principal" : "Reserva";
}

function walletSubtitle(wallet: Wallet) {
  return wallet.secondaryAddress && wallet.slot === "secondary" ? wallet.secondaryAddress : shortAddress(wallet.address);
}

function networkLine(network: Network) {
  return network === "ethereum" ? "Rede principal Ethereum" : `Rede ${NETWORK_LABEL[network]}`;
}

/* -------------------------------------------------------------------------- */
/* Campos do formulário                                                       */
/* -------------------------------------------------------------------------- */

type Form = ReturnType<typeof useForm<CheckoutFormValues, unknown, CheckoutFormValues>>;

function CheckoutFields({ form, columns, onManualWalletEdit }: { form: Form; columns: 1 | 2; onManualWalletEdit: () => void }) {
  const { errors } = form.formState;
  const reg = (name: (typeof CHECKOUT_FIELDS)[number], manual = false) =>
    form.register(name, manual ? { onChange: onManualWalletEdit } : undefined);
  const inputCls = "h-9";

  return (
    <div className={cn("grid gap-x-4 gap-y-4", columns === 2 && "sm:grid-cols-2")}>
      <FormField label="Nome de exibição" required error={errors.displayName?.message}>
        {(c) => <Input {...c} {...reg("displayName")} autoComplete="name" className={inputCls} />}
      </FormField>
      <FormField label="Nome de usuário" required error={errors.username?.message}>
        {(c) => <Input {...c} {...reg("username")} autoComplete="username" className={inputCls} />}
      </FormField>
      <FormField label="Rede" required error={errors.network?.message}>
        {(c) => (
          <Controller
            control={form.control}
            name="network"
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onValueChange={(v) => {
                  field.onChange(v);
                  onManualWalletEdit();
                }}
              >
                <SelectTrigger {...c} onBlur={field.onBlur} className="h-9 w-full text-xs data-[placeholder]:text-muted-foreground">
                  <SelectValue placeholder="Selecione uma rede" />
                </SelectTrigger>
                <SelectContent className="border-border bg-card">
                  {Network.options.map((n) => (
                    <SelectItem key={n} value={n}>
                      {NETWORK_LABEL[n]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </FormField>
      <FormField label="Nome do perfil" required error={errors.profileName?.message}>
        {(c) => <Input {...c} {...reg("profileName")} className={inputCls} />}
      </FormField>
      <FormField label="Endereço da carteira" required error={errors.address?.message}>
        {(c) => (
          <Input
            {...c}
            {...reg("address", true)}
            placeholder="Endereço 0x da carteira"
            spellCheck={false}
            autoComplete="off"
            className={cn(inputCls, "text-xs")}
          />
        )}
      </FormField>
      <FormField
        label="ENS ou carteira secundária (opcional)"
        srOnlyLabel={columns === 2}
        error={errors.secondaryAddress?.message}
        className={cn(columns === 2 && "sm:justify-end")}
      >
        {(c) => (
          <Input
            {...c}
            {...reg("secondaryAddress")}
            placeholder="ENS ou carteira secundária (opcional)"
            className={cn(inputCls, "text-xs")}
          />
        )}
      </FormField>
      <FormField label="Tipo de carteira" required error={errors.walletType?.message}>
        {(c) => (
          <Controller
            control={form.control}
            name="walletType"
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onValueChange={(v) => {
                  field.onChange(v);
                  onManualWalletEdit();
                }}
              >
                <SelectTrigger {...c} onBlur={field.onBlur} className="h-9 w-full text-xs data-[placeholder]:text-muted-foreground">
                  <SelectValue placeholder="Selecione uma carteira" />
                </SelectTrigger>
                <SelectContent className="border-border bg-card">
                  {WalletType.options.map((t) => (
                    <SelectItem key={t} value={t}>
                      {WALLET_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </FormField>
      <FormField label="Código de indicação" required error={errors.referralCode?.message}>
        {(c) => <Input {...c} {...reg("referralCode")} autoComplete="off" className={inputCls} />}
      </FormField>
      <FormField label="E-mail" required error={errors.email?.message}>
        {(c) => <Input {...c} {...reg("email")} type="email" autoComplete="email" className={inputCls} />}
      </FormField>
      <FormField label="Nome ENS" required error={errors.ensName?.message}>
        {(c) => (
          <div className="flex">
            <Input {...c} {...reg("ensName")} autoComplete="off" spellCheck={false} className={cn(inputCls, "rounded-r-none")} />
            <select
              aria-label="Sufixo ENS"
              className="h-9 rounded-r-[3px] border border-l-0 border-input bg-input-bg px-2 text-sm"
              defaultValue=".eth"
            >
              <option value=".eth">.eth</option>
            </select>
          </div>
        )}
      </FormField>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Página                                                                     */
/* -------------------------------------------------------------------------- */

function firstErrorField(errors: FieldErrors<CheckoutFormValues>) {
  return CHECKOUT_FIELDS.find((f) => errors[f]);
}

function CheckoutContent({ user, wallets }: { user: User; wallets: WalletsResponse }) {
  const desktop = useIsDesktop();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const owner = useCartOwner();
  const { data: cart } = useCart();
  const pendingOrders = usePendingOrders();
  const pendingOrder = pendingOrders.data?.items[0];

  const form = useForm<CheckoutFormValues, unknown, CheckoutFormValues>({
    resolver: zodResolver(CheckoutFormSchema),
    defaultValues: checkoutStorage.readDraft<CheckoutFormValues>(user.id) ?? emptyDefaults(user, wallets.primary),
    reValidateMode: "onChange",
  });
  const [network, walletType, address, walletChoice] = useWatch({
    control: form.control,
    name: ["network", "walletType", "address", "walletChoice"],
  });
  const activeNetwork = network || undefined;

  // Rascunho persistido: sobrevive a refresh e à expiração da sessão.
  useEffect(() => {
    const sub = form.watch((values) => checkoutStorage.writeDraft(user.id, values));
    return () => sub.unsubscribe();
  }, [form, user.id]);

  const quote = useQuote(activeNetwork);
  const fetchQuote = useFetchQuote();
  const connect = useConnectWallet();
  const disconnect = useDisconnectWallet();
  const placeOrder = usePlaceOrder();

  const [connection, setConnection] = useState<WalletConnection | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState<Quote | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(walletChoice === "other");
  const [preparing, setPreparing] = useState(false);
  const submitting = useRef(false);

  // Conexão vale para a combinação carteira/rede/endereço em que foi feita.
  useEffect(() => {
    if (connection && (connection.address !== address || connection.network !== network || connection.walletType !== walletType)) {
      setConnection(null);
      disconnect.mutate(connection.id);
      announce("A carteira foi desconectada porque os dados de pagamento mudaram.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, network, walletType]);

  const chooseWallet = (choice: WalletChoice) => {
    form.setValue("walletChoice", choice);
    const wallet = choice === "primary" ? wallets.primary : choice === "secondary" ? wallets.secondary : null;
    if (wallet) {
      for (const [key, value] of Object.entries(walletDefaults(wallet))) {
        form.setValue(key as keyof CheckoutFormValues, value as never, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
      }
    } else {
      form.setValue("address", "", { shouldDirty: true });
      form.setValue("secondaryAddress", "", { shouldDirty: true });
      form.setValue("walletType", "", { shouldDirty: true });
      setDetailsOpen(true);
    }
  };

  const markManual = () => {
    if (form.getValues("walletChoice") !== "other") form.setValue("walletChoice", "other");
  };

  const disconnectWallet = () => {
    if (!connection) return;
    disconnect.mutate(connection.id);
    setConnection(null);
    toast.info("Carteira desconectada");
    announce("Carteira desconectada.");
  };

  /** Passo 1: valida, conecta a carteira (simulada) e revalida a cotação. */
  const startReview = async () => {
    if (submitting.current) return;
    setFormMessage(null);
    setConnectError(null);
    const valid = await form.trigger();
    if (!valid) {
      setDetailsOpen(true);
      const field = firstErrorField(form.formState.errors);
      setFormMessage("Revise os campos destacados antes de continuar.");
      if (field) setTimeout(() => form.setFocus(field), 0);
      return;
    }
    const values = CheckoutFormSchema.parse(form.getValues());
    submitting.current = true;
    setPreparing(true);
    try {
      let conn = connection;
      if (!conn) {
        try {
          conn = await connect.mutateAsync({
            walletType: values.walletType as WalletType,
            network: values.network as Network,
            address: values.address,
          });
          setConnection(conn);
          announce(`${WALLET_TYPE_LABEL[conn.walletType]} conectada.`);
        } catch (error) {
          const apiError = toApiError(error);
          if (apiError.fields.walletAddress) {
            form.setError("address", { type: "server", message: apiError.fields.walletAddress }, { shouldFocus: true });
            setDetailsOpen(true);
          }
          setConnectError(
            apiError.code === "WALLET_REJECTED"
              ? "A conexão foi recusada na carteira. Aprove a solicitação e tente novamente."
              : apiError.message,
          );
          return;
        }
      }
      const fresh = await fetchQuote(values.network as Network);
      setAcknowledged(fresh);
      setReviewError(null);
      setTimedOut(false);
      setReviewOpen(true);
    } catch (error) {
      setFormMessage(toApiError(error).message);
    } finally {
      submitting.current = false;
      setPreparing(false);
    }
  };

  /** Passo 2: envia o pedido com a cotação aceita (idempotente). */
  const confirmOrder = () => {
    if (placeOrder.isPending || !acknowledged || !connection) return;
    const values = form.getValues();
    const input: CreateOrderInput = {
      quoteId: acknowledged.id,
      network: values.network as Network,
      walletConnectionId: connection.id,
      walletType: values.walletType as WalletType,
      walletAddress: values.address.trim(),
      buyer: toBuyer(values),
    };
    setReviewError(null);
    placeOrder.mutate(input, {
      onSuccess: (order) => {
        setTimedOut(false);
        setReviewOpen(false);
        announce("Pedido enviado. Aguardando confirmação da rede.");
        void navigate({ to: "/pedidos/$orderId", params: { orderId: order.id }, replace: true });
      },
      onError: (error) => {
        const apiError = toApiError(error);
        const details = apiError.details as { orderId?: string } | undefined;
        switch (apiError.code) {
          case "TIMEOUT":
          case "NETWORK_ERROR":
            setTimedOut(true);
            announce("O servidor não respondeu. Tente novamente para recuperar o mesmo pedido.", "assertive");
            return;
          case "QUOTE_STALE":
          case "AVAILABILITY_CONFLICT": {
            const next = quoteFromError(apiError.details);
            if (next) queryClient.setQueryData(qk.quote(owner, next.network), next);
            void queryClient.invalidateQueries({ queryKey: qk.carts });
            setTimedOut(false);
            setReviewError(apiError.code === "QUOTE_STALE" ? "Os valores mudaram. Revise e confirme novamente." : apiError.message);
            announce(apiError.message, "assertive");
            return;
          }
          case "WALLET_NOT_CONNECTED":
            setConnection(null);
            setReviewOpen(false);
            setConnectError(apiError.message);
            return;
          case "IDEMPOTENCY_CONFLICT":
            checkoutStorage.clearAttempt(user.id);
            setReviewError("Não foi possível reaproveitar a tentativa anterior. Confirme novamente.");
            return;
          case "CONFLICT":
            if (details?.orderId) {
              setReviewOpen(false);
              void navigate({ to: "/pedidos/$orderId", params: { orderId: details.orderId } });
              return;
            }
            setReviewError(apiError.message);
            return;
          case "VALIDATION_ERROR": {
            setReviewOpen(false);
            const general = applyServerErrors(error, form.setError, CHECKOUT_FIELDS);
            setFormMessage(general ?? "Revise os campos destacados.");
            return;
          }
          default:
            setReviewError(apiError.message);
        }
      },
    });
  };

  const blockedByCart = Boolean(cart?.hasBlockingIssues);
  const busy = preparing || connect.isPending;
  const confirmDisabled = busy || blockedByCart || Boolean(pendingOrder) || !cart?.items.length;
  const summaryQuote = quote.data;

  const alerts = (
    <>
      {pendingOrder && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-primary/50 bg-primary/10 p-3 text-xs"
        >
          <span>Você já tem um pedido em processamento. Aguarde a confirmação antes de iniciar outra compra.</span>
          <Link to="/pedidos/$orderId" params={{ orderId: pendingOrder.id }} className="font-bold text-primary hover:underline">
            Ver pedido
          </Link>
        </div>
      )}
      {blockedByCart && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-destructive/60 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="size-4" aria-hidden /> A disponibilidade de itens do carrinho mudou.
          </span>
          <Link to="/carrinho" className="font-bold underline">
            Ajustar carrinho
          </Link>
        </div>
      )}
      <FormAlert message={formMessage} />
      <FormAlert message={connectError} />
    </>
  );

  const connectionStatus = (
    <div className="flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs" aria-live="polite">
      {connect.isPending ? (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Aguardando aprovação na{" "}
          {walletType ? WALLET_TYPE_LABEL[walletType as WalletType] : "carteira"}…
        </span>
      ) : connection ? (
        <>
          <span className="flex items-center gap-1.5 text-success" data-testid="wallet-connected">
            <PlugZap className="size-3.5" aria-hidden /> Conectada: {WALLET_TYPE_LABEL[connection.walletType]} ·{" "}
            {shortAddress(connection.address)}
          </span>
          <button type="button" onClick={disconnectWallet} className="flex items-center gap-1 text-primary hover:underline">
            <Unplug className="size-3.5" aria-hidden /> Desconectar
          </button>
        </>
      ) : (
        <span className="text-muted-foreground">A carteira será conectada ao confirmar a compra.</span>
      )}
    </div>
  );

  const providers = (variant: "desktop" | "mobile") => (
    <fieldset className="flex flex-col gap-2.5">
      <legend className={cn("mb-3 font-bold", variant === "desktop" ? "w-full text-center text-sm" : "text-lg")}>Carteira e rede</legend>
      {WalletType.options.map((type) => (
        <RadioCard
          key={type}
          name={`provider-${variant}`}
          value={type}
          checked={walletType === type}
          onChange={() => {
            form.setValue("walletType", type, { shouldValidate: form.formState.isSubmitted });
            markManual();
          }}
          markPosition={variant === "mobile" ? "end" : "start"}
          testId={`provider-${type}`}
          className={variant === "mobile" ? "rounded-xl border-transparent bg-card p-3" : "h-8 px-3 text-xs"}
        >
          {variant === "mobile" ? (
            <span className="flex items-center gap-4 text-base">
              <span aria-hidden className="grid size-9 place-items-center rounded-full bg-surface-strong font-bold text-primary">
                {PROVIDER_BADGE[type]}
              </span>
              {WALLET_TYPE_LABEL[type]}
            </span>
          ) : type === "walletconnect" ? (
            <>
              <span className="sr-only">WalletConnect</span>
              <WalletsChip className="px-2 py-0.5 text-[0.55rem]" />
            </>
          ) : (
            WALLET_TYPE_LABEL[type]
          )}
        </RadioCard>
      ))}
    </fieldset>
  );

  const registeredWallets = [wallets.primary, wallets.secondary].filter((w): w is Wallet => Boolean(w));

  const review = (
    <ReviewDialog
      open={reviewOpen}
      onOpenChange={(open) => {
        setReviewOpen(open);
        if (!open) setReviewError(null);
      }}
      acknowledged={acknowledged}
      latest={timedOut ? (acknowledged ?? undefined) : quote.data}
      refreshing={quote.isFetching && !timedOut}
      onAcceptLatest={() => {
        if (quote.data) setAcknowledged(quote.data);
        setReviewError(null);
        announce("Novos valores aceitos para revisão.");
      }}
      onConfirm={confirmOrder}
      placing={placeOrder.isPending}
      error={reviewError}
      timedOut={timedOut}
      connection={connection}
      buyer={reviewOpen ? toBuyer(form.getValues()) : null}
    />
  );

  /* ------------------------------- mobile ------------------------------- */
  if (!desktop) {
    return (
      <div className="flex min-h-dvh flex-col pb-32">
        <MobileTopBar title="Pagamento com carteira" asHeading fallback="/carrinho" />
        <div className="flex flex-col gap-5 px-6">
          <form
            id="checkout-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void startReview();
            }}
            className="flex flex-col gap-5"
          >
            {alerts}
            <section aria-labelledby="carteira-conectada" className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 id="carteira-conectada" className="text-[clamp(1rem,4.6vw,1.125rem)] font-bold">
                  Carteira conectada
                </h2>
                <button
                  type="button"
                  onClick={() => chooseWallet("other")}
                  className="text-[clamp(0.875rem,4vw,1rem)] font-bold text-price hover:underline"
                >
                  Trocar carteira
                </button>
              </div>
              {registeredWallets.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma carteira cadastrada.{" "}
                  <Link to="/perfil/carteiras" className="text-primary underline">
                    Cadastrar carteiras
                  </Link>{" "}
                  ou preencha os dados abaixo.
                </p>
              )}
              <div role="radiogroup" aria-labelledby="carteira-conectada" className="flex flex-col gap-3">
                {registeredWallets.map((wallet) => (
                  <div key={wallet.id} className="relative">
                    <RadioCard
                      name="registered-wallet-mobile"
                      value={wallet.slot}
                      checked={walletChoice === wallet.slot}
                      onChange={() => chooseWallet(wallet.slot)}
                      testId={`wallet-${wallet.slot}`}
                      className="rounded-xl border-transparent bg-card py-4 pr-12 pl-5"
                    >
                      <span className="flex flex-col gap-0.5 pl-3">
                        <strong className="text-lg">{walletLabel(wallet)}</strong>
                        <span className="text-base text-muted-foreground">{walletSubtitle(wallet)}</span>
                        <span className="text-base text-muted-foreground">{networkLine(wallet.network)}</span>
                      </span>
                    </RadioCard>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Opções da carteira ${walletLabel(wallet)}`}
                          className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-primary hover:bg-accent"
                        >
                          <EllipsisVertical className="size-5" aria-hidden />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="border-border bg-card">
                        <DropdownMenuItem asChild>
                          <Link to="/perfil/carteiras">Editar carteira</Link>
                        </DropdownMenuItem>
                        {connection && walletChoice === wallet.slot && (
                          <DropdownMenuItem onSelect={disconnectWallet}>Desconectar</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
              {connectionStatus}
            </section>

            {providers("mobile")}

            <section className="rounded-xl bg-card">
              <button
                type="button"
                aria-expanded={detailsOpen}
                aria-controls="dados-colecionador"
                onClick={() => setDetailsOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-base font-bold"
              >
                Dados do colecionador
                <ChevronDown className={cn("size-5 transition-transform", detailsOpen && "rotate-180")} aria-hidden />
              </button>
              <div id="dados-colecionador" hidden={!detailsOpen} className="flex flex-col gap-4 px-4 pb-4">
                <CheckoutFields form={form} columns={1} onManualWalletEdit={markManual} />
                <FormField label="Observação do colecionador (opcional)" error={form.formState.errors.note?.message}>
                  {(c) => <Textarea {...c} {...form.register("note")} rows={3} />}
                </FormField>
              </div>
            </section>
          </form>

          <details className="rounded-xl bg-card px-4 py-3">
            <summary className="cursor-pointer text-base font-bold">Resumo do pedido ({cart?.itemCount ?? 0} itens)</summary>
            <div className="mt-3 flex flex-col gap-3">
              {summaryQuote ? (
                <>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {summaryQuote.lines.map((l) => (
                      <li key={l.cartItemId} className="flex justify-between gap-2">
                        <span>
                          {l.name} (x {l.quantity})
                        </span>
                        <span className="font-bold text-price">{formatEth(l.lineTotal)}</span>
                      </li>
                    ))}
                  </ul>
                  <CouponForm coupon={summaryQuote.coupon} variant="mobile" />
                  <SummaryRows summary={{ ...summaryQuote, feeEstimated: true }} size="lg" />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Selecione uma carteira para calcular as taxas da rede.</p>
              )}
            </div>
          </details>

          <p className="flex items-baseline justify-end gap-6 text-xl font-bold" aria-live="polite">
            Total:{" "}
            <span className="text-2xl text-price" data-testid="checkout-total">
              {summaryQuote ? formatEth(summaryQuote.total) : "—"}
            </span>
          </p>

          <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background to-transparent px-6 pt-6 pb-6">
            <Button type="submit" form="checkout-form" variant="pill" size="xl" className="w-full" disabled={confirmDisabled}>
              {busy ? "Conectando carteira…" : "Confirmar compra"}
            </Button>
          </div>
        </div>
        {review}
      </div>
    );
  }

  /* ------------------------------- desktop ------------------------------ */
  return (
    <div className="container-page flex flex-col gap-4 pt-6">
      <Breadcrumbs items={[{ label: "Início", to: "/" }, { label: "Mercado", to: "/", hash: "catalogo" }, { label: "Pagamento" }]} />
      <h1 className="sr-only">Pagamento</h1>
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] xl:gap-12">
        <form
          id="checkout-form"
          noValidate
          aria-labelledby="perfil-colecionador"
          onSubmit={(e) => {
            e.preventDefault();
            void startReview();
          }}
          className="flex flex-col gap-4"
        >
          <h2 id="perfil-colecionador" className="text-sm font-bold">
            Perfil do colecionador
          </h2>
          {alerts}
          <CheckoutFields form={form} columns={2} onManualWalletEdit={markManual} />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-bold">Carteira para pagamento</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
              {registeredWallets.map((wallet) => (
                <RadioCard
                  key={wallet.id}
                  name="registered-wallet"
                  value={wallet.slot}
                  checked={walletChoice === wallet.slot}
                  onChange={() => chooseWallet(wallet.slot)}
                  testId={`wallet-${wallet.slot}`}
                  className="border-0"
                >
                  {walletLabel(wallet)} · {walletSubtitle(wallet)} · {NETWORK_LABEL[wallet.network]}
                </RadioCard>
              ))}
              <RadioCard
                name="registered-wallet"
                value="other"
                checked={walletChoice === "other"}
                onChange={() => chooseWallet("other")}
                className="border-0"
              >
                Usar outra carteira?
              </RadioCard>
            </div>
            {registeredWallets.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Dica: cadastre suas carteiras em{" "}
                <Link to="/perfil/carteiras" className="text-primary underline">
                  Perfil › Carteiras
                </Link>{" "}
                para preencher automaticamente.
              </p>
            )}
          </fieldset>

          <FormField label="Observação do colecionador (opcional)" error={form.formState.errors.note?.message} className="max-w-[31rem]">
            {(c) => <Textarea {...c} {...form.register("note")} rows={6} className="min-h-28" />}
          </FormField>
        </form>

        <aside aria-labelledby="seus-nfts" className="flex flex-col gap-3">
          <h2 id="seus-nfts" className="text-sm font-bold">
            Seus NFTs
          </h2>
          <div className="flex justify-between border-b border-border pb-1 text-xs font-bold">
            <span>NFTs</span>
            <span>Subtotal</span>
          </div>
          {summaryQuote ? (
            <ul className="flex flex-col gap-1.5" aria-label="Itens do pedido">
              {summaryQuote.lines.map((line) => (
                <li key={line.cartItemId} className="flex items-center gap-2 bg-card py-1 pr-2 pl-1">
                  <NftImage image={line.image} sizes="44px" decorative className="size-11 shrink-0 rounded-[4px]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{line.name}</p>
                    <p className="text-[0.65rem] text-muted-foreground">ID do token: {line.tokenId}</p>
                  </div>
                  <span className="text-[0.65rem] text-muted-foreground">(x {line.quantity})</span>
                  <span className="text-xs font-bold whitespace-nowrap text-price">{formatEth(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
          ) : quote.isPending && activeNetwork ? (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: cart?.items.length || 3 }, (_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Selecione a rede para calcular a cotação.</p>
          )}

          {showCoupon || summaryQuote?.coupon ? (
            <CouponForm coupon={summaryQuote?.coupon ?? null} />
          ) : (
            <button type="button" onClick={() => setShowCoupon(true)} className="text-center text-xs hover:text-primary">
              Tem um código promocional? <span className="underline-offset-2 hover:underline">Aplique aqui</span>
            </button>
          )}

          {summaryQuote ? (
            <div className="border-b border-border pb-3 [&_[data-testid=summary-total]]:text-sm">
              <SummaryRows summary={{ ...summaryQuote, feeEstimated: true }} />
            </div>
          ) : quote.isPending && activeNetwork ? (
            <SummarySkeleton />
          ) : quote.error ? (
            <ErrorState error={quote.error} onRetry={() => void quote.refetch()} retrying={quote.isRefetching} className="py-4" />
          ) : null}

          {providers("desktop")}
          {connectionStatus}

          <Button type="submit" form="checkout-form" className="h-9 text-xs" disabled={confirmDisabled}>
            {busy ? "Conectando carteira…" : "Confirmar compra"}
          </Button>
        </aside>
      </div>
      {review}
    </div>
  );
}

/**
 * O carrinho esvaziou com uma tentativa de pedido em aberto (ex.: o pedido foi
 * criado e confirmado, mas a resposta se perdeu por timeout). Reenvia a MESMA
 * tentativa — mesma chave de idempotência e conteúdo — e leva ao pedido.
 */
function OrderRecovery({ user, attempt, onGiveUp }: { user: User; attempt: CheckoutAttempt; onGiveUp: () => void }) {
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const input = JSON.parse(attempt.fingerprint) as CreateOrderInput;
    ordersApi
      .create(input, attempt.idempotencyKey)
      .then((order) => {
        announce("Encontramos seu pedido.");
        void navigate({ to: "/pedidos/$orderId", params: { orderId: order.id }, replace: true });
      })
      .catch(() => {
        checkoutStorage.clearAttempt(user.id);
        onGiveUp();
      });
  }, [attempt, navigate, onGiveUp, user.id]);

  return (
    <div
      className="container-page flex min-h-[50dvh] flex-col items-center justify-center gap-3 py-16 text-center"
      role="status"
      data-testid="order-recovery"
    >
      <Loader2 className="size-8 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
      <p className="text-sm">Recuperando seu pedido…</p>
    </div>
  );
}

export function CheckoutPage() {
  const user = useCurrentUser();
  const [attempt, setAttempt] = useState(() => (user ? checkoutStorage.readAttempt(user.id) : null));
  const desktop = useIsDesktop();
  const wallets = useWallets();
  const cart = useCart();
  const pending = usePendingOrders();

  if (!user) return null;

  if (wallets.isPending || cart.isPending) {
    return (
      <div
        className={cn(desktop ? "container-page pt-10" : "px-6 pt-24")}
        aria-busy="true"
        aria-label="Carregando pagamento"
        data-testid="checkout-skeleton"
      >
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_18rem]">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
          <SummarySkeleton />
        </div>
      </div>
    );
  }

  const error = wallets.error ?? cart.error;
  if (error) {
    return (
      <div className="container-page py-12">
        <ErrorState
          error={error}
          onRetry={() => {
            void wallets.refetch();
            void cart.refetch();
          }}
        />
      </div>
    );
  }

  if (!cart.data?.items.length) {
    if (attempt) return <OrderRecovery user={user} attempt={attempt} onGiveUp={() => setAttempt(null)} />;
    const pendingOrder = pending.data?.items[0];
    return (
      <>
        <MobileTopBar title="Pagamento com carteira" asHeading fallback="/carrinho" />
        <div className="container-page py-12">
          <EmptyState
            title={pendingOrder ? "Seu pedido está em processamento" : "Seu carrinho está vazio"}
            description={
              pendingOrder
                ? "Acompanhe a confirmação do pagamento na página do pedido."
                : "Adicione NFTs ao carrinho para finalizar uma compra."
            }
            action={
              <Button asChild>
                {pendingOrder ? (
                  <Link to="/pedidos/$orderId" params={{ orderId: pendingOrder.id }}>
                    Ver pedido
                  </Link>
                ) : (
                  <Link to="/" hash="catalogo">
                    Explorar o mercado
                  </Link>
                )}
              </Button>
            }
          />
        </div>
      </>
    );
  }

  return <CheckoutContent user={user} wallets={wallets.data!} />;
}
