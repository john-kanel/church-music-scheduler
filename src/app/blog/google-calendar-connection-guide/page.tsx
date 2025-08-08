export const metadata = {
  title: 'Google Calendar Connection Guide | Church Music Pro',
  description:
    'Step-by-step guide to connect your dedicated Google Calendar and share it with your team.',
  alternates: { canonical: '/blog/google-calendar-connection-guide' },
}

export default function Post() {
  return (
    <div className="min-h-screen bg-gray-50">
      <article className="prose prose-slate max-w-3xl mx-auto px-4 py-12 bg-white rounded-lg shadow-sm">
        <h1>Google Calendar Connection Guide</h1>
        <p>
          Connect a dedicated Google Calendar so events sync automatically. Then share a read-only link
          with your team from Google Calendar.
        </p>
        <h2>Connect</h2>
        <ol>
          <li>In the app, open Calendar → Connect Google Calendar.</li>
          <li>Approve access. We create a dedicated calendar for your church.</li>
          <li>Run “Sync Now” to send events.</li>
        </ol>
        <h2>Share</h2>
        <ol>
          <li>Open Google Calendar (web). Find the dedicated calendar under “My calendars”.</li>
          <li>Click “Options → Settings and sharing”.</li>
          <li>Copy the shareable link and send to your team (read-only).</li>
        </ol>
        <p>Tip: Use our Public Schedule link for musicians to view roles and music.</p>
      </article>
    </div>
  )
}


