export const metadata = {
  title: 'Google Calendar Connection Guide | Church Music Pro',
  description:
    'Step-by-step guide to connect your dedicated Google Calendar and share it with your team.',
  alternates: { canonical: '/blog/google-calendar-connection-guide' },
}

export default function Post() {
  return (
    <div className="min-h-screen">
      <article className="max-w-3xl mx-auto px-4 py-12 bg-white rounded-lg shadow-sm border">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Google Calendar Connection Guide</h1>
        <p className="text-gray-800 mb-6">
          Connect a dedicated Google Calendar so events sync automatically. Then share a read-only link
          with your team from Google Calendar.
        </p>
        <h2 className="text-2xl font-semibold text-gray-900 mt-6 mb-3">Connect</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-800">
          <li>In the app, open Calendar → Connect Google Calendar.</li>
          <li>Approve access. We create a dedicated calendar for your church.</li>
          <li>Run “Sync Now” to send events.</li>
        </ol>
        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-3">Share</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-800">
          <li>Open Google Calendar (web). Find the dedicated calendar under “My calendars”.</li>
          <li>Click “Options → Settings and sharing”.</li>
          <li>Copy the shareable link and send to your team (read-only).</li>
        </ol>
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
          Tip: Use the Public Schedule link for musicians to view roles and music without logging in.
        </div>
      </article>
    </div>
  )
}


