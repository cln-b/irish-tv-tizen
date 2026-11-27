// One Cloudflare Worker for both legacy TV apps:
//   RTÉ        /servicelayer/...  or  /rte/servicelayer/...
//   TG4+       /tg4/sso/...       or  /tg4/user/...

const RTE_PATH = '/servicelayer/api/idm/account/soip/login';
const RTE_QUERY = '?isocode=IE';

const TG4_ROUTES = [
    {prefix: '/sso/register', target: 'https://sso.tg4.ie/register', methods: ['POST']},
    {prefix: '/sso/associate', target: 'https://sso.tg4.ie/associate', methods: ['POST']},
    {prefix: '/sso/token', target: 'https://sso.tg4.ie/token', methods: ['POST']},
    {prefix: '/sso/api/v2/session/user/profile', target: 'https://sso.tg4.ie/api/v2/session/user/profile', methods: ['GET']},
    {prefix: '/sso/api/v2/session/logout', target: 'https://sso.tg4.ie/api/v2/session/logout', methods: ['DELETE']},
    {prefix: '/user/api/playlist/v3/watch_later', target: 'https://user.tg4.ie/api/playlist/v3/watch_later', methods: ['GET', 'POST', 'DELETE']},
    {prefix: '/user/api/history/v2', target: 'https://user.tg4.ie/api/history/v2', methods: ['POST']}
];
const TG4_CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Token-Type, Accept, X-TG4-Helper-Key',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Cache-Control': 'no-store'
};

function tg4Headers(extra = {}) {
    return new Headers({...TG4_CORS, ...extra});
}

// Each app has its own secret so knowing the Worker URL is not enough to use
// its proxy. Compare SHA-256 digests, which are fixed length.
async function helperKeyMatches(supplied, expected) {
    if (!expected) return false;
    const digest = value => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    const expectedBytes = new Uint8Array(await digest(expected));
    const suppliedBytes = new Uint8Array(await digest(supplied || ''));
    if (suppliedBytes.length !== expectedBytes.length) return false;
    let difference = 0;
    for (let i = 0; i < expectedBytes.length; i++) difference |= expectedBytes[i] ^ suppliedBytes[i];
    return difference === 0;
}

function tg4RouteFor(pathname) {
    for (const route of TG4_ROUTES) {
        if (pathname === route.prefix || pathname.startsWith(route.prefix + '/')) return route;
    }
    return null;
}

async function handleRteLogin(request, env, upstreamFetch, pathname, search) {
    const headers = new Headers({'Cache-Control': 'no-store', 'Content-Type': 'application/json', 'Vary': 'Origin'});
    const reply = (status, data) => new Response(JSON.stringify(data), {status, headers});
    const origin = request.headers.get('Origin');
    if (origin && origin !== 'null' && origin !== 'file://') return reply(403, {error: 'Origin is not allowed'});
    if (origin) headers.set('Access-Control-Allow-Origin', origin);
    if (pathname !== RTE_PATH || search !== RTE_QUERY) return reply(404, {error: 'Unknown endpoint'});
    if (request.method === 'OPTIONS') {
        headers.set('Access-Control-Allow-Methods', 'POST');
        headers.set('Access-Control-Allow-Headers', 'Content-Type, X-RTE-Helper-Key');
        headers.set('Access-Control-Max-Age', '600');
        return new Response(null, {status: 204, headers});
    }
    if (!env.SECRET_KEY) return reply(503, {error: 'Worker needs configuration'});
    if (!(await helperKeyMatches(request.headers.get('X-RTE-Helper-Key') || '', env.SECRET_KEY))) {
        return reply(403, {error: 'Invalid helper key'});
    }
    if (request.method !== 'POST') return reply(405, {error: 'POST is required'});
    const reader = request.body?.getReader();
    let body = '', size = 0;
    try {
        if (!reader) return reply(400, {error: 'Missing body'});
        const decoder = new TextDecoder();
        while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 1024) {
                await reader.cancel();
                return reply(413, {error: 'Request is too large'});
            }
            body += decoder.decode(value, {stream: true});
        }
        body += decoder.decode();
        const data = JSON.parse(body);
        if (!data || Object.keys(data).length !== 1 || typeof data.deviceId !== 'string' || !/^\d{15}$/.test(data.deviceId)) {
            return reply(400, {error: 'A 15 digit deviceId is required'});
        }
    } catch {
        return reply(400, {error: 'Invalid body'});
    }
    try {
        const response = await upstreamFetch('https://www.rte.ie' + RTE_PATH + RTE_QUERY, {
            method: 'POST', headers: {'Accept': '*/*', 'Content-Type': 'application/json'},
            body, redirect: 'manual', signal: AbortSignal.timeout(15000)
        });
        if (response.status >= 300 && response.status < 400) {
            await response.body?.cancel();
            return reply(502, {error: 'Unexpected RTÉ redirect'});
        }
        return new Response(response.body, {status: response.status, headers});
    } catch {
        return reply(502, {error: 'RTÉ login request failed'});
    }
}

export async function handleLogin(request, env, upstreamFetch = fetch) {
    const url = new URL(request.url);
    return handleRteLogin(request, env, upstreamFetch, url.pathname, url.search);
}

async function handleTg4(request, env, upstreamFetch, pathname, search) {
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: tg4Headers()});
    const route = tg4RouteFor(pathname);
    if (!route || !route.methods.includes(request.method)) {
        return new Response('not found', {status: 404, headers: tg4Headers({'Content-Type': 'text/plain'})});
    }
    if (!env.TG4_SECRET_KEY) {
        return new Response('helper needs configuration', {status: 503, headers: tg4Headers({'Content-Type': 'text/plain'})});
    }
    if (!(await helperKeyMatches(request.headers.get('X-TG4-Helper-Key') || '', env.TG4_SECRET_KEY))) {
        return new Response('invalid helper key', {status: 403, headers: tg4Headers({'Content-Type': 'text/plain'})});
    }
    try {
        const headers = new Headers({'Accept': 'application/json'});
        for (const name of ['content-type', 'authorization', 'token-type']) {
            const value = request.headers.get(name);
            if (value) headers.set(name, value);
        }
        const init = {method: request.method, headers, redirect: 'manual'};
        if (request.method !== 'GET') init.body = await request.arrayBuffer();
        const response = await upstreamFetch(route.target + search, init);
        const out = tg4Headers({'Content-Type': response.headers.get('content-type') || 'application/json'});
        for (const name of ['etag', 'last-modified']) {
            const value = response.headers.get(name);
            if (value) out.set(name, value);
        }
        return new Response(response.body, {status: response.status, headers: out});
    } catch {
        return new Response('helper error', {status: 502, headers: tg4Headers({'Content-Type': 'text/plain'})});
    }
}

export async function handleRequest(request, env, upstreamFetch = fetch) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (pathname === '/rte' || pathname.startsWith('/rte/')) {
        return handleRteLogin(request, env, upstreamFetch, pathname.slice(4) || '/', url.search);
    }
    if (pathname === '/tg4' || pathname.startsWith('/tg4/')) {
        return handleTg4(request, env, upstreamFetch, pathname.slice(4) || '/', url.search);
    }
    return handleRteLogin(request, env, upstreamFetch, pathname, url.search);
}

export default {fetch(request, env) { return handleRequest(request, env); }};
