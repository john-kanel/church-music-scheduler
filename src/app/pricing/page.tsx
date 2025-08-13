export const metadata = {
  title: 'Pricing | Church Music Pro',
  description: 'Simple, affordable pricing. Unlimited musicians and events. Try it free for 30–60 days.',
  alternates: { canonical: '/pricing' },
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Pricing</h1>
          <p className="mt-3 text-lg text-gray-700 max-w-3xl">
            One simple price. Unlimited musicians, unlimited events, all features included.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto md:grid-rows-1">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Monthly</h2>
            <div className="mb-4">
              <span className="text-4xl font-bold text-brand-600">$35</span>
              <span className="text-gray-600">/month</span>
            </div>
            <ul className="text-gray-700 space-y-2 mb-6 list-disc list-inside">
              <li>Unlimited musicians and events</li>
              <li>Public sign‑ups with PIN (no accounts)</li>
              <li>Live iCal feed (Apple/Google/Outlook)</li>
              <li>Email & SMS reminders</li>
              <li>Groups, service parts, event documents</li>
              <li>Pastor reports</li>
            </ul>
            <a href="/auth/signup" className="inline-block bg-brand-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-brand-700 transition-colors">Start 30‑Day Free Trial</a>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-success-500 relative overflow-visible pt-12 md:pt-10">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-success-500 text-white px-4 py-1 rounded-full text-sm font-medium">Best Value</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Annual</h2>
            <div className="mb-2">
              <div className="text-lg text-gray-500 line-through">$420/year</div>
              <div>
                <span className="text-4xl font-bold text-success-600">$200</span>
                <span className="text-gray-600">/year</span>
              </div>
            </div>
            <ul className="text-gray-700 space-y-2 mb-6 list-disc list-inside">
              <li>Everything in Monthly</li>
              <li>Save 52% annually</li>
              <li>Priority support</li>
            </ul>
            <a href="/auth/signup" className="inline-block bg-success-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-success-700 transition-colors">Start 60‑Day Free Trial</a>
          </div>
        </div>
      </main>
    </div>
  )
}


