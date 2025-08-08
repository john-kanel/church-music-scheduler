import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') || 'Church Music Pro'
  const subtitle = searchParams.get('subtitle') || 'Church music scheduling made simple'

  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          background: '#ffffff',
          padding: '64px',
          fontFamily: 'Montserrat',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <img src="https://churchmusicpro.com/apple-touch-icon.png" alt="Logo" width={64} height={64} />
          <span style={{ fontSize: 28, fontWeight: 700, marginLeft: 12, color: '#072A5D' }}>Church Music Pro</span>
        </div>
        <div style={{ fontSize: 64, fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>{title}</div>
        <div style={{ fontSize: 28, marginTop: 16, color: '#374151' }}>{subtitle}</div>
        <div style={{ marginTop: 32, fontSize: 20, color: '#6B7280' }}>churchmusicpro.com</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}


