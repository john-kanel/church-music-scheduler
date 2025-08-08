export const metadata = {
  title: 'Music Scheduling Best Practices | Church Music Pro',
  description:
    'Save hours each month with simple patterns for planning, assigning roles, and sharing music.',
  alternates: { canonical: '/blog/music-scheduling-best-practices' },
}

export default function Post() {
  return (
    <div className="min-h-screen bg-gray-50">
      <article className="prose prose-slate max-w-3xl mx-auto px-4 py-12 bg-white rounded-lg shadow-sm">
        <h1>Music Scheduling Best Practices</h1>
        <ul>
          <li>Plan 4–6 weeks ahead; use recurring events.</li>
          <li>Use groups for choirs/bands; assign gaps later.</li>
          <li>Upload PDFs so hymns auto-populate.</li>
          <li>Share read-only calendar links with pastors and staff.</li>
        </ul>
        <p>These habits reduce back-and-forth and last-minute scrambles.</p>
      </article>
    </div>
  )
}


