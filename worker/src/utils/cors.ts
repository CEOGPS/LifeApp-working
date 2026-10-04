export function corsHeaders(origin?: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id, X-LifeOS-Key, X-LifeOS-Key-Service, X-LifeOS-Key-Nvidia, X-LifeOS-Key-Ollama", // PATCH (api-key-wiring)
    "Access-Control-Allow-Credentials": "true",
  };
}

export function handleCors(request: Request): Response | null {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders(request.headers.get("Origin") || "*"),
    });
  }
  // For non-OPTIONS requests, add CORS headers to the response via middleware
  return null;
}

export function withCors(response: Response, origin?: string): Response {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(origin);
  Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}