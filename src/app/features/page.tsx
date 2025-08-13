export const metadata = {
  title: 'Features | Church Music Pro',
  description:
    'Scheduling built for church music: public sign-ups with PIN, unlimited musicians, live iCal feeds, email/SMS reminders, groups, service parts, and pastor reports.',
  alternates: { canonical: '/features' },
}

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Church Music Pro Features</h1>
          <p className="mt-3 text-lg text-gray-700 max-w-3xl">
            Save hours every month with tools built specifically for church music directors. No accounts for musicians,
            one public link for sign-ups, and a calendar that updates itself.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Public Sign‑Ups (No Accounts)</h2>
          <p className="text-gray-700 mb-4">
            Share one public link. Musicians pick an open role and confirm with a simple 4‑digit PIN—no app installs, no
            passwords. You can also assign people directly when needed.
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>PIN‑confirmed sign‑ups (no user accounts required)</li>
            <li>Unlimited musicians and unlimited events</li>
            <li>Group support for choir, band, or teams</li>
          </ul>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Live Calendar Everywhere</h2>
          <p className="text-gray-700 mb-4">
            A live iCal feed keeps iPhone, Google, Outlook, and Apple Calendar up to date—automatically. Documents can be
            accessed right from the calendar event.
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>Works with iPhone, Google, Outlook, and Apple Calendar</li>
            <li>Recurring events with flexible patterns</li>
            <li>Event documents available via secure links in calendar descriptions</li>
          </ul>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Email & SMS Reminders</h2>
          <p className="text-gray-700 mb-4">
            Automatic reminders make sure the right people get the right message at the right time—without you sending a
            single text.
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>Pre‑event reminders by email and SMS</li>
            <li>Targeted nudges for unconfirmed roles</li>
            <li>Pastor weekly/monthly reports</li>
          </ul>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Service Parts & Music Files</h2>
          <p className="text-gray-700 mb-4">
            Match your service flow with customizable parts and attach PDFs so everyone shows up prepared. Files are
            reachable from the live calendar feed.
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>Custom service parts</li>
            <li>Event documents with secure access</li>
            <li>History of songs across events</li>
          </ul>
        </section>

        <div className="mt-10">
          <a
            href="/auth/signup"
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors shadow"
          >
            Start 30‑Day Free Trial
          </a>
          <p className="text-sm text-gray-600 mt-3">No credit card required. Cancel anytime.</p>
        </div>
      </main>
    </div>
  )
}


