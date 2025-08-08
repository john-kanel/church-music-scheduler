export const metadata = {
  title: 'Transitioning from Spreadsheets to Church Music Pro',
  description: 'A simple migration checklist to get organized in under an hour.',
  alternates: { canonical: '/blog/transitioning-from-spreadsheets-to-church-music-pro' },
}

export default function Post() {
  return (
    <div className="min-h-screen">
      <article className="max-w-3xl mx-auto px-4 py-12 bg-white rounded-lg shadow-sm border">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Transitioning from Spreadsheets to Church Music Pro</h1>
        <p className="text-gray-800 mb-6">Use this 45-minute plan to move your workflow with minimal disruption.</p>
        <ol className="list-decimal list-inside space-y-2 text-gray-800">
          <li>Export musician list (CSV) and clean names/emails.</li>
          <li>Create groups (choir, band, cantor) and import musicians.</li>
          <li>Set recurring services and locations.</li>
          <li>Upload PDF service orders so hymns auto-populate.</li>
          <li>Share the read-only calendar link; enable weekly pastor report.</li>
        </ol>
        <p className="text-gray-800 mt-6">You can always refine later—get the basics live first.</p>
      </article>
    </div>
  )
}


