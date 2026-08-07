export const dynamic = 'force-dynamic';

export function GET() {
  const svg = `
    <svg width="72" height="72" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" onload="alert('remote onload should be stripped')">
      <script>alert('remote script should be stripped')</script>
      <circle cx="36" cy="36" r="30" fill="#14b8a6" onclick="alert('remote onclick should be stripped')" />
      <path d="M24 36h24M36 24v24" stroke="white" stroke-width="7" stroke-linecap="round" />
    </svg>
  `;

  return new Response(svg, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'image/svg+xml; charset=utf-8'
    }
  });
}
