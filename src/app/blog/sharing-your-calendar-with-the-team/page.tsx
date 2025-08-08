export const metadata = {
  title: 'Sharing Your Calendar with the Team | Church Music Pro',
  description:
    'How to share read-only calendars with musicians, pastors, and staff—Google and iCal options.',
  alternates: { canonical: '/blog/sharing-your-calendar-with-the-team' },
}

export default function Post() {
  return (
    <div className="min-h-screen bg-gray-50">
      <article className="prose prose-slate max-w-3xl mx-auto px-4 py-12 bg-white rounded-lg shadow-sm">
        <h1>Sharing Your Calendar with the Team</h1>
        <h2>Google Calendar (Recommended)</h2>
        <ol>
          <li>Open Google Calendar → dedicated church calendar → Settings and sharing.</li>
          <li>Copy shareable link; send to the team.</li>
        </ol>
        <h2>iCal Link (Apple/Outlook)</h2>
        <p>Use the live iCal subscription link for automatic updates in Apple and Outlook.</p>
      </article>
    </div>
  )
}


