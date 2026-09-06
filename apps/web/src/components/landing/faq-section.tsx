/** FAQ section shared by the landing and pricing pages. */

const FAQS = [
  {
    q: 'Do I need any special hardware?',
    a: 'No. PharmaGuard runs in the browser on the computer or phone you already use. The AI scanner works from ordinary photos of medicine packaging.',
  },
  {
    q: 'Does the AI add medicines without my approval?',
    a: 'Never. Every AI extraction is shown to you with confidence scores and must be reviewed and confirmed before it becomes an inventory record.',
  },
  {
    q: 'Is PharmaGuard DRAP certification?',
    a: 'No. PharmaGuard is compliance support tooling that keeps your records organised and exportable. It is not, and does not generate, official DRAP certification.',
  },
  {
    q: 'Can my staff use it too?',
    a: 'Yes. Invite users with OWNER, MANAGER, PHARMACIST or STAFF roles - every member gets full access to normal features, with owner-only control for team management.',
  },
  {
    q: 'What happens to my data?',
    a: 'Your pharmacy data is isolated from every other pharmacy by row-level security, and audit logs record who changed what and when.',
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="bg-surface-muted">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary-700">FAQ</p>
        <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
          Questions pharmacists actually ask.
        </h2>
        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-lg border border-border bg-surface px-5 py-4 shadow-sm"
            >
              <summary className="cursor-pointer list-none text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-4">
                  {faq.q}
                  <span
                    className="text-text-muted transition-transform duration-150 group-open:rotate-45"
                    aria-hidden
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
