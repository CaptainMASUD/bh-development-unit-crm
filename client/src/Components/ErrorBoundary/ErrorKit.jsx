import React from "react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";

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

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10">
      <path
        className="fill-white/90"
        d="M12 2 4 5v6c0 5 3.5 9.2 8 11 4.5-1.8 8-6 8-11V5l-8-3Zm0 7.5a1 1 0 0 1 1 1V14a1 1 0 1 1-2 0V10.5a1 1 0 0 1 1-1Zm0 8a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
      />
    </svg>
  );
}

function ErrorCard({ title, message, action="Retry", onAction, details, tag }) {
  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white">
      <GlowDots />
      <div className="mx-auto grid min-h-dvh max-w-2xl place-items-center p-6">
        <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-4">
              <span className="inline-grid place-items-center rounded-2xl bg-white/10 p-4 ring-1 ring-white/20">
                <IconShield />
              </span>
              <div>
                <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
                <p className="mt-1 text-white/70">{message}</p>
              </div>
            </div>
            {tag ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] font-medium tracking-wide text-white/90 backdrop-blur">
                {tag}
              </span>
            ) : null}
          </div>

          {details ? (
            <details className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm open:shadow-inner">
              <summary className="cursor-pointer select-none font-medium text-white/90">Technical details</summary>
              <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-white/80">{details}</pre>
            </details>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {onAction ? (
              <PremiumButton onClick={onAction}>
                <svg viewBox="0 0 24 24" className="h-4 w-4">
                  <path className="fill-white/80" d="M12 5v4l4-4-4-4v4a7 7 0 1 0 7 7h-2a5 5 0 1 1-5-5Z"/>
                </svg>
                {action}
              </PremiumButton>
            ) : null}
            <PremiumButton as="a" href="/">
              <svg viewBox="0 0 24 24" className="h-4 w-4">
                <path className="fill-white/80" d="M12 3 2 12h3v8h6v-5h2v5h6v-8h3L12 3Z"/>
              </svg>
              Home
            </PremiumButton>
            {details ? (
              <PremiumButton
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(typeof details === "string" ? details : "");
                  } catch {}
                }}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4">
                  <path className="fill-white/80" d="M8 3h9a2 2 0 0 1 2 2v9h-2V5H8V3Zm-3 4h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm0 2v9h9V9H5Z"/>
                </svg>
                Copy details
              </PremiumButton>
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-between text-[11px] text-white/50">
            <span>If this keeps happening, contact support with steps to reproduce.</span>
            <span className="rounded-md bg-white/5 px-2 py-0.5 ring-1 ring-white/10">Ref: {new Date().toISOString().slice(0,10)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Default export: global crash boundary */
export default class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) {}
  reset = () => this.setState({ hasError: false, error: null });
  render() {
    return this.state.hasError
      ? (
        <ErrorCard
          title="Something broke in the app"
          message={this.state.error?.message || "An unexpected error occurred."}
          action="Reset view"
          onAction={this.reset}
          details={process.env.NODE_ENV !== "production" ? (this.state.error?.stack || "") : undefined}
          tag="GLOBAL"
        />
      )
      : this.props.children;
  }
}

/* Named export: route/loader/action errors */
export function RouteError() {
  const err = useRouteError();
  if (isRouteErrorResponse(err)) {
    const code = err.status;
    const msg = err.statusText || (typeof err.data === "string" ? err.data : "A route error occurred.");
    const friendly =
      code === 404 ? "We couldn’t find that page." :
      code === 401 ? "You’re not authorized to view this." :
      code === 500 ? "The server had a problem." :
      "This page failed to load.";
    return (
      <ErrorCard
        title={`${code} • ${friendly}`}
        message={msg}
        action="Go back"
        onAction={() => history.back()}
        details={process.env.NODE_ENV !== "production" ? JSON.stringify(err, null, 2) : undefined}
        tag="ROUTE"
      />
    );
  }
  const message = err instanceof Error ? err.message : "An unexpected error occurred.";
  return (
    <ErrorCard
      title="Page failed to load"
      message={message}
      action="Reload"
      onAction={() => location.reload()}
      details={process.env.NODE_ENV !== "production" ? JSON.stringify(err, null, 2) : undefined}
      tag="ROUTE"
    />
  );
}
