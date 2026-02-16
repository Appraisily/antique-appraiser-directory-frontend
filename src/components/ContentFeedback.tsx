import React, { useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { capturePosthogEvent } from '../lib/posthog';
import { derivePageContext } from '../utils/analytics';

function redactFeedbackText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const redactedEmail = trimmed.replace(
    /([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/gi,
    '[redacted-email]'
  );
  const redactedPhone = redactedEmail.replace(
    /(\+?\d[\d\s().-]{7,}\d)/g,
    '[redacted-phone]'
  );
  return redactedPhone;
}

export function ContentFeedback() {
  const location = useLocation();
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const yesButtonRef = useRef<HTMLButtonElement | null>(null);

  const context = useMemo(() => derivePageContext(location.pathname), [location.pathname]);

  const commonProps = useMemo(
    () => ({
      page_type: context.pageType,
      page_category: context.pageCategory,
      city_slug: context.citySlug,
      appraiser_slug: context.appraiserSlug,
      page_path: location.pathname,
      location: 'content_feedback',
    }),
    [context, location.pathname]
  );

  const onVote = (value: boolean) => {
    if (submitted) return;
    setHelpful(value);
    setValidationError(null);

    capturePosthogEvent('seo_content_feedback_vote', {
      ...commonProps,
      helpful: value,
    });
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (submitted) return;
    if (helpful === null) {
      setValidationError('Choose Yes or No to submit feedback.');
      try {
        yesButtonRef.current?.focus();
      } catch {
        // ignore
      }
      return;
    }

    const redacted = redactFeedbackText(comment).slice(0, 800);

    capturePosthogEvent('seo_content_feedback_submitted', {
      ...commonProps,
      helpful,
      comment: redacted,
      comment_length: redacted.length,
    });

    setSubmitted(true);
  };

  return (
    <section className="w-full border-t border-border/60 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-2xl border border-border/70 bg-background p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Was this page helpful?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Optional: tell us what was missing (please don’t include personal info).
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onVote(true)}
              disabled={submitted}
              ref={yesButtonRef}
              className={[
                'rounded-full border px-4 py-2 text-sm font-semibold transition',
                helpful === true
                  ? 'border-blue-500/60 bg-blue-500/10 text-foreground'
                  : 'border-border bg-background hover:bg-muted/40 text-foreground',
                submitted ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => onVote(false)}
              disabled={submitted}
              className={[
                'rounded-full border px-4 py-2 text-sm font-semibold transition',
                helpful === false
                  ? 'border-blue-500/60 bg-blue-500/10 text-foreground'
                  : 'border-border bg-background hover:bg-muted/40 text-foreground',
                submitted ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              No
            </button>
          </div>

          {submitted ? (
            <p className="mt-4 text-sm font-medium text-foreground">
              Thanks — this helps us improve the directory.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-4">
              {validationError ? (
                <p className="mb-3 text-sm font-medium text-red-700" role="alert">
                  {validationError}
                </p>
              ) : null}
              <textarea
                className="w-full min-h-24 resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                placeholder="What could we improve on this page?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="submit"
                  className={[
                    'rounded-xl bg-gray-900 text-white px-4 py-2 text-sm font-semibold shadow-sm transition',
                    'hover:bg-gray-800 cursor-pointer',
                  ].join(' ')}
                >
                  Send feedback
                </button>
                <span className="text-xs text-muted-foreground">We redact emails/phone numbers client-side.</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
