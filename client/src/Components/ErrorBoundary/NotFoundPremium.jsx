import React from "react";

function GlowDots() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
    </div>
  );
}

function PremiumButton({ children, onClick, as = "button", href }) {
  const cls =
    "group inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white " +
    "ring-1 ring-white/20 hover:ring-white/30 hover:bg-white/10 active:scale-[.98] transition";
  if (as === "a") return <a className={cls} href={href}>{children}</a>;
  return <button className={cls} onClick={onClick}>{children}</button>;
}

export default function NotFoundPremium() {
  const [q, setQ] = React.useState("");

  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white">
      <GlowDots />
      <div className="mx-auto grid min-h-dvh max-w-2xl place-items-center p-6">
        <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          <div className="flex items-start gap-4">
            <span className="inline-grid place-items-center rounded-2xl bg-white/10 p-4 ring-1 ring-white/20">
              <svg viewBox="0 0 24 24" className="h-10 w-10">
                <path className="fill-white/90" d="M12 3 2 12h3v8h6v-5h2v5h6v-8h3L12 3Zm-1 13h2v2h-2v-2Z" />
              </svg>
            </span>
            <div>
              <h1 className="text-2xl font-semibold leading-tight">404 • Page not found</h1>
              <p className="mt-1 text-white/70">
                The link may be broken or the page may have moved. Try searching or head back home.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-2 ring-1 ring-white/10 focus-within:ring-white/20">
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
                <path className="fill-white/70" d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm9.71 16.29-3.4-3.4a9.5 9.5 0 1 0-1.41 1.41l3.4 3.4a1 1 0 0 0 1.41-1.41Z"/>
              </svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search site…"
                className="w-full bg-transparent text-sm text-white/90 placeholder:text-white/50 focus:outline-none"
              />
              <PremiumButton
                onClick={() => {
                  if (!q.trim()) return;
                  const target = `/search?q=${encodeURIComponent(q.trim())}`;
                  window.location.href = target;
                }}
              >
                Search
              </PremiumButton>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <PremiumButton as="a" href="/" >
              <svg viewBox="0 0 24 24" className="h-4 w-4"><path className="fill-white/80" d="M12 3 2 12h3v8h6v-5h2v5h6v-8h3L12 3Z"/></svg>
              Home
            </PremiumButton>
            <PremiumButton onClick={() => history.back()}>
              <svg viewBox="0 0 24 24" className="h-4 w-4"><path className="fill-white/80" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2Z"/></svg>
              Go back
            </PremiumButton>
            <PremiumButton onClick={() => (window.location.href = "/sitemap")}>
              <svg viewBox="0 0 24 24" className="h-4 w-4"><path className="fill-white/80" d="M10 3h4v4h-4V3Zm-7 7h4v4H3v-4Zm14 0h4v4h-4v-4ZM10 17h4v4h-4v-4Zm2-8v3H9v2h6v-2h-3V9ZM7 12h3v2H7v-2Zm7 0h3v2h-3v-2Z"/></svg>
              Sitemap
            </PremiumButton>
          </div>

          <div className="mt-6 text-right text-[11px] text-white/50">
            Ref: {new Date().toISOString().slice(0,10)}
          </div>
        </div>
      </div>
    </div>
  );
}
