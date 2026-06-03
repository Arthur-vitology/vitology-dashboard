export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};

export default function middleware(request) {
  const auth = request.headers.get('authorization');
  const expectedUser = process.env.SITE_USER || 'vitology';
  const expectedPass = process.env.SITE_PASSWORD;

  if (!expectedPass) {
    return new Response('SITE_PASSWORD env var not configured', { status: 500 });
  }

  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded);
      const sepIdx = decoded.indexOf(':');
      const user = decoded.slice(0, sepIdx);
      const pass = decoded.slice(sepIdx + 1);
      if (user === expectedUser && pass === expectedPass) {
        return;
      }
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Vitology Dashboard"' },
  });
}
