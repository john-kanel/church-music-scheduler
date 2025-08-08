export const metadata = {
  title: 'Rehearsal Planning That Actually Works | Church Music Pro',
  description: 'A practical template for predictable, focused rehearsals every week.',
  alternates: { canonical: '/blog/rehearsal-planning-that-actually-works' },
}

export default function Post() {
  return (
    <div className="min-h-screen">
      <article className="max-w-3xl mx-auto px-4 py-12 bg-white rounded-lg shadow-sm border">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Rehearsal Planning That Actually Works</h1>
        <p className="text-gray-800 mb-6">Use this repeatable structure to keep rehearsals efficient and positive.</p>
        <ol className="list-decimal list-inside space-y-2 text-gray-800">
          <li>10 minutes: prayer + overview; assign any openings.</li>
          <li>20 minutes: new music sections; mark problem spots.</li>
          <li>20 minutes: transitions between songs/service parts.</li>
          <li>10 minutes: run-through; note final fixes.</li>
          <li>Follow-up: share music files and notes the next morning.</li>
        </ol>
        <p className="text-gray-800 mt-6">Consistency builds confidence and reduces Sunday stress.</p>
      </article>
    </div>
  )
}


