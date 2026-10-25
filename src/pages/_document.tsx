import { Head, Html, Main, NextScript } from "next/document";
import { getImageProps } from "next/image";

/**
 * Pré-carrega a arte do hero (elemento LCP da tela inicial) já no HTML.
 * Como a página catch-all é a mesma para todas as rotas, um script inline
 * mínimo só injeta o preload quando a rota é "/". `srcset`/`sizes` são os
 * mesmos do <Image> do hero, então o navegador reaproveita o download.
 */
function heroPreloadScript() {
  const variants = [
    { media: "(min-width: 768px)", sizes: "(min-width: 1024px) 448px, 384px" },
    { media: "(max-width: 767.98px)", sizes: "40vw" },
  ].map(({ media, sizes }) => {
    const { props } = getImageProps({ src: "/nfts/emerald-ape.png", alt: "", fill: true, sizes });
    return { media, sizes, srcSet: props.srcSet };
  });
  return `(function(){if(location.pathname!=="/")return;${JSON.stringify(variants)}.forEach(function(v){var l=document.createElement("link");l.rel="preload";l.as="image";l.setAttribute("imagesrcset",v.srcSet);l.setAttribute("imagesizes",v.sizes);l.media=v.media;l.setAttribute("fetchpriority","high");document.head.appendChild(l);});})();`;
}

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head>
        <meta name="theme-color" content="#120b09" />
        <meta name="color-scheme" content="dark" />
        <meta name="application-name" content="Kurio" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script dangerouslySetInnerHTML={{ __html: heroPreloadScript() }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
