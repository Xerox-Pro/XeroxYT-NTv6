// Read JSON before returning so body timeouts can still trigger peer failover.
// Media streams only time out while connecting; their bodies may run longer.
export async function fetchApiResponse(url, options, timeoutMs, fetcher = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('API response timed out', 'TimeoutError')), timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  try {
    const response = await fetcher(url, {...options, signal});
    if (response.body && response.headers.get('content-type')?.includes('application/json')) {
      const body = await response.arrayBuffer();
      return new Response(body, {status: response.status, statusText: response.statusText, headers: response.headers});
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}
