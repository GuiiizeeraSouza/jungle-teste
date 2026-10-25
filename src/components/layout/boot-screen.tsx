/** Tela exibida enquanto o bundle da aplicação e a camada de mocks iniciam. */
export function BootScreen() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="container-page hidden h-16 items-center justify-between border-b border-border md:flex">
        <span className="text-sm font-bold tracking-[0.2em]">KURIO</span>
      </div>
      <div className="container-page flex min-h-[60dvh] items-center justify-center md:hidden">
        <span className="text-4xl font-bold tracking-[0.2em]">KURIO</span>
      </div>
      <p role="status" className="sr-only">
        Carregando a Kurio…
      </p>
    </div>
  );
}
