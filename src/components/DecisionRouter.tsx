import React from 'react';
import { ChevronRight, ShieldCheck } from 'lucide-react';

export const DECISION_ROUTER_VARIANT = 'bw_icons_v1';
export const DECISION_ROUTER_ICON_SET = 'custom_20260514';

type DecisionRouterProps = {
  signedReportUrl: string;
  screenerUrl: string;
  localHref: string;
  localLabel: string;
  professionalSampleUrl: string;
  instantSampleUrl: string;
  campaign: string;
  className?: string;
  onCtaClick?: (ctaKind: string, placement: string, destination: string) => void;
  onLocalClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  onRouterView?: (placement: string, visibleRatio: number) => void;
};

const choices = [
  {
    kind: 'signed_report',
    title: 'Online signed report',
    copy: 'Choose this when photos and documentation are sufficient. After secure checkout, submit photos, marks, labels, and notes for a signed written valuation report.',
    cta: 'Start a paid online appraisal',
    iconSrc: '/assets/decision-router-report.png',
  },
  {
    kind: 'screener',
    title: 'Free screener',
    copy: 'Use Screener for a first-pass category, evidence, and next-step read.',
    cta: 'Try the free screener',
    iconSrc: '/assets/decision-router-screener.png',
  },
  {
    kind: 'local_specialist',
    title: 'Local specialist',
    copy: 'Choose a local specialist when the assignment requires an in-person inspection or local expertise.',
    cta: 'Find a local specialist',
    iconSrc: '/assets/decision-router-local.png',
  },
] as const;

export function DecisionRouter({
  signedReportUrl,
  screenerUrl,
  localHref,
  localLabel,
  professionalSampleUrl,
  campaign,
  className = '',
  onCtaClick,
  onLocalClick,
  onRouterView,
}: DecisionRouterProps) {
  const routerRef = React.useRef<HTMLElement | null>(null);
  const hasTrackedViewRef = React.useRef(false);
  const destinations = {
    signed_report: signedReportUrl,
    screener: screenerUrl,
    local_specialist: localHref,
  };

  React.useEffect(() => {
    if (!onRouterView || hasTrackedViewRef.current) return;

    const node = routerRef.current;
    if (!node || typeof window === 'undefined') return;

    const trackView = (visibleRatio: number) => {
      if (hasTrackedViewRef.current) return;
      hasTrackedViewRef.current = true;
      onRouterView('decision_router', visibleRatio);
    };

    if (!('IntersectionObserver' in window)) {
      const timeoutId = window.setTimeout(() => trackView(1), 0);
      return () => window.clearTimeout(timeoutId);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.35) {
          trackView(entry.intersectionRatio);
          observer.disconnect();
        }
      },
      { threshold: [0.35, 0.6] }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [onRouterView]);

  return (
    <section
      ref={routerRef}
      data-appraisily-directory-decision-router="1"
      data-router-variant={DECISION_ROUTER_VARIANT}
      data-icon-set={DECISION_ROUTER_ICON_SET}
      className={`scroll-mt-24 rounded-xl border border-slate-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.07)] md:p-8 ${className}`}
    >
      <div className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-slate-500">Choose your next step</p>
        <h2 className="mt-3 text-[1.75rem] font-bold leading-tight text-slate-950 md:text-4xl">
          Match the appraisal path to the decision you need to make
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-700 md:text-lg">
          Use this directory when local or specialist review matters.
        </p>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {choices.map((choice) => {
          const destination = destinations[choice.kind];
          const isLocal = choice.kind === 'local_specialist';
          const label = isLocal ? localLabel : choice.cta;

          return (
            <a
              key={choice.kind}
              href={destination}
              className="block rounded-lg border border-slate-200 bg-white p-4 text-inherit no-underline shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2"
              data-gtm-event="directory_cta"
              data-cta-kind={choice.kind}
              data-gtm-placement="decision_router"
              data-gtm-campaign={campaign}
              onClick={(event) => {
                onCtaClick?.(choice.kind, 'decision_router', destination);
                if (isLocal) {
                  onLocalClick?.(event);
                }
              }}
            >
              <div className="flex items-start gap-4">
                <img
                  src={choice.iconSrc}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  loading="lazy"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-xl font-bold leading-snug text-slate-950">{choice.title}</h3>
                    <ChevronRight className="mt-1 h-6 w-6 shrink-0 text-slate-400" aria-hidden="true" />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{choice.copy}</p>
                </div>
              </div>
              <span
                className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2"
              >
                {label}
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </span>
            </a>
          );
        })}
      </div>

      <div
        data-appraisily-directory-sample-proof="1"
        className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 md:flex md:items-center md:justify-between md:gap-5"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-bold text-slate-950">Proof you can trust</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Sample reports, credentials, and how our process works.
            </p>
          </div>
        </div>
        <a
          href={professionalSampleUrl}
          className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 font-bold text-slate-950 transition-colors hover:bg-slate-50 md:mt-0 md:w-auto"
          data-gtm-event="directory_cta"
          data-cta-kind="sample_report"
          data-gtm-placement="sample_proof"
          data-gtm-campaign={campaign}
          data-clarity-action="directory_sample_report_open"
          onClick={() => onCtaClick?.('sample_report', 'sample_proof', professionalSampleUrl)}
        >
          View sample report
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
