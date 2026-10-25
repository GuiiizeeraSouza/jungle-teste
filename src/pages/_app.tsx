import { useEffect } from "react";
import type { AppProps } from "next/app";
import localFont from "next/font/local";
import Router from "next/router";
import "@/styles/globals.css";

const robotoMono = localFont({
  src: [
    { path: "../fonts/roboto-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/roboto-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/roboto-mono-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});

export default function KurioApp({ Component, pageProps }: AppProps) {
  // O TanStack Router é o único dono do histórico: o roteador do Next ignora popstate.
  useEffect(() => {
    Router.beforePopState(() => false);
  }, []);

  return (
    <>
      <style jsx global>{`
        :root {
          --font-roboto-mono: ${robotoMono.style.fontFamily};
        }
      `}</style>
      <Component {...pageProps} />
    </>
  );
}
