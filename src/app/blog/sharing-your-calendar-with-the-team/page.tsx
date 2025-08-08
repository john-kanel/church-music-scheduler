export const metadata = {
  title: 'Sharing Your Calendar with the Team | Church Music Pro',
  description:
    'How to share read-only calendars with musicians, pastors, and staff—Google and iCal options.',
  alternates: { canonical: '/blog/sharing-your-calendar-with-the-team' },
}

export default function Post() {
  return (
    <div className="min-h-screen">
      <article className="max-w-3xl mx-auto px-4 py-12 bg-white rounded-lg shadow-sm border">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Sharing Your Calendar with the Team</h1>
        <h2 className="text-2xl font-semibold text-gray-900 mt-6 mb-3">Google Calendar (Recommended)</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-800">
          <li>Open Google Calendar → your dedicated church calendar → Settings and sharing.</li>
          <li>Copy the shareable link and send it to the team.</li>
        </ol>
        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-3">iCal Link (Apple/Outlook)</h2>
        <p className="text-gray-800">Use the live iCal subscription link for automatic updates in Apple and Outlook.</p>
      </article>
    </div>
  )
}


