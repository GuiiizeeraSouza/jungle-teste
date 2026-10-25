"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Category } from "@/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from "@/components/shared/brand-icons";
import { notAvailable } from "@/components/shared/misc";
import { emailField } from "@/contracts";
import { cn } from "@/lib/utils";

const FEATURES = [
  { letter: "W", title: "Segurança da carteira", text: "Proteja sua carteira e colecione arte digital verificada com confiança." },
  { letter: "C", title: "Criadores em destaque", text: "Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede." },
  {
    letter: "D",
    title: "Alertas de lançamentos",
    text: "Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.",
  },
];

const SOCIAL = [
  { label: "Facebook", href: "https://www.facebook.com", Icon: FacebookIcon },
  { label: "Instagram", href: "https://www.instagram.com", Icon: InstagramIcon },
  { label: "Twitter", href: "https://twitter.com", Icon: TwitterIcon },
  { label: "LinkedIn", href: "https://www.linkedin.com", Icon: LinkedinIcon },
  { label: "YouTube", href: "https://www.youtube.com", Icon: YoutubeIcon },
];

const COLLECTION_LINKS: Array<{ label: string; category: Category }> = [
  { label: "Arte digital", category: "arte-digital" },
  { label: "Fotografia", category: "fotografia" },
  { label: "Música", category: "musica" },
  { label: "Arte 3D", category: "arte-3d" },
  { label: "Utilidade", category: "utilidade" },
];

const linkClass = "text-xs text-foreground/90 transition-colors hover:text-primary";

function Unavailable({ label }: { label: string }) {
  return (
    <button type="button" className={cn(linkClass, "text-left")} onClick={() => notAvailable(label)}>
      {label}
    </button>
  );
}

function Newsletter() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const result = emailField.safeParse(email);
        if (!result.success) {
          setError(result.error.issues[0]?.message ?? "E-mail inválido");
          return;
        }
        setError(null);
        notAvailable("A inscrição em alertas de lançamento");
      }}
    >
      <h2 className="text-sm leading-tight font-bold">Antecipe-se ao próximo lançamento</h2>
      <div className="flex">
        <label htmlFor="newsletter-email" className="sr-only">
          Seu e-mail
        </label>
        <Input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="digite seu e-mail..."
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "newsletter-error" : undefined}
          className="h-9 rounded-r-none border-r-0 bg-[#2a1c15] text-xs"
        />
        <Button type="submit" className="h-9 rounded-l-none px-4">
          Enviar
        </Button>
      </div>
      {error && (
        <p id="newsletter-error" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
      </p>
    </form>
  );
}

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("container-page pt-16 pb-6", className)}>
      <div className="bg-card">
        <div className="grid gap-8 px-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:px-8">
          {FEATURES.map((feature) => (
            <div key={feature.letter} className="flex flex-col gap-3 lg:border-r lg:border-primary/80 lg:px-6 lg:first:pl-2">
              <span
                aria-hidden
                className="grid size-12 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground"
              >
                {feature.letter}
              </span>
              <h2 className="text-sm font-bold">{feature.title}</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">{feature.text}</p>
            </div>
          ))}
          <div className="lg:pl-6">
            <Newsletter />
          </div>
        </div>

        <div className="grid gap-3 bg-band px-6 py-5 text-xs sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <span className="font-bold tracking-[0.18em]">KURIO</span>
          <span>
            Feito para colecionadores,
            <br />
            criadores e cultura
          </span>
          <a href="mailto:contato@email.com" className="hover:text-primary">
            contato@email.com
          </a>
          <a href="tel:+551140028922" className="hover:text-primary">
            +55 11 4002 8922
          </a>
        </div>

        <div className="grid grid-cols-2 gap-8 px-6 py-8 lg:grid-cols-4 lg:px-8">
          <nav aria-labelledby="footer-perfil" className="flex flex-col gap-2.5">
            <h2 id="footer-perfil" className="mb-1 text-sm font-bold">
              Meu perfil
            </h2>
            <Link to="/perfil" className={linkClass}>
              Meu perfil
            </Link>
            <Unavailable label="Minha coleção" />
            <Unavailable label="Atividade" />
            <Unavailable label="Estúdio do criador" />
            <Link to="/perfil/lista-de-interesse" className={linkClass}>
              Lista de interesse
            </Link>
          </nav>
          <nav aria-labelledby="footer-ajuda" className="flex flex-col gap-2.5">
            <h2 id="footer-ajuda" className="mb-1 text-sm font-bold">
              Central de ajuda
            </h2>
            {["Central de ajuda", "Como comprar NFTs", "Carteira e segurança", "Política do mercado", "Denunciar item"].map((label) => (
              <Unavailable key={label} label={label} />
            ))}
          </nav>
          <nav aria-labelledby="footer-colecoes" className="flex flex-col gap-2.5">
            <h2 id="footer-colecoes" className="mb-1 text-sm font-bold">
              Coleções
            </h2>
            {COLLECTION_LINKS.map((item) => (
              <Link key={item.category} to="/" search={{ categoria: [item.category] }} hash="catalogo" className={linkClass}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="col-span-2 flex flex-col gap-3 lg:col-span-1">
            <h2 className="text-sm font-bold">Redes sociais</h2>
            <ul className="flex flex-wrap gap-1.5">
              {SOCIAL.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Kurio no ${label} (abre em nova aba)`}
                    className="grid size-8 place-items-center rounded-[3px] border border-primary/40 text-primary hover:bg-primary/10"
                  >
                    <Icon className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
            <h2 className="mt-3 text-sm font-bold">Carteiras compatíveis</h2>
            <WalletsChip />
          </div>
        </div>
      </div>
      <p className="mt-5 text-center text-xs text-foreground/90">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  );
}

export function WalletsChip({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex w-fit max-w-full flex-wrap items-center gap-x-2 rounded-[4px] border border-primary/30 bg-band px-3 py-1.5 text-[10px] font-bold tracking-wide text-primary",
        className,
      )}
    >
      METAMASK <span aria-hidden>•</span> WALLETCONNECT <span aria-hidden>•</span> COINBASE
    </p>
  );
}
