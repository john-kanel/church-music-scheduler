export const metadata = {
  title: 'Music Scheduling Best Practices | Church Music Pro',
  description:
    'Save hours each month with simple patterns for planning, assigning roles, and sharing music.',
  alternates: { canonical: '/blog/music-scheduling-best-practices' },
}

export default function Post() {
  return (
    <div className="min-h-screen">
      <article className="max-w-3xl mx-auto px-4 py-12 bg-white rounded-lg shadow-sm border">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Music Scheduling Best Practices</h1>
        <p className="text-gray-800 mb-6">These simple patterns save hours each month:</p>
        <ol className="list-decimal list-inside space-y-2 text-gray-800">
          <li>Plan 4–6 weeks ahead; use recurring events for predictable services.</li>
          <li>Use groups for choirs/bands; fill individual gaps closer to the event.</li>
          <li>Upload PDFs so hymns auto-populate and service parts generate automatically.</li>
          <li>Share read-only calendar links with pastors and staff to reduce one-off messages.</li>
          <li>Enable weekly pastor reports so leadership always knows what’s coming.</li>
        </ol>
        <p className="text-gray-800 mt-6">Consistency eliminates last-minute scrambles.</p>
      </article>
    </div>
  )
}


