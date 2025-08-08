export const metadata = {
  title: 'Blog | Church Music Pro',
  description: 'Practical guidance for church music directors on scheduling, calendars, and running rehearsals.',
}

export default function BlogIndexPage() {
  const posts = [
    {
      slug: 'google-calendar-connection-guide',
      title: 'Google Calendar Connection Guide',
      excerpt: 'How to connect and share your dedicated church calendar in Google Calendar, step by step.',
    },
    {
      slug: 'music-scheduling-best-practices',
      title: 'Music Scheduling Best Practices',
      excerpt: 'Simple patterns to save hours each month and avoid last-minute scrambles.',
    },
    {
      slug: 'sharing-your-calendar-with-the-team',
      title: 'Sharing Your Calendar with the Team',
      excerpt: 'The easiest ways to share read-only calendars with pastors and musicians.',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Church Music Pro Blog</h1>
        <div className="space-y-6">
          {posts.map((p) => (
            <a
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="block bg-white rounded-xl shadow-sm border p-6 hover:shadow transition"
            >
              <h2 className="text-xl font-semibold text-gray-900">{p.title}</h2>
              <p className="text-gray-600 mt-2">{p.excerpt}</p>
              <div className="text-blue-600 mt-3">Read more →</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}


