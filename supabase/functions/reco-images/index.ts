import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const url = Deno.env.get('SUPABASE_URL')!;
const secrets = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const secret = secrets.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const bucket = 'reco-reply-images';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-reco-key, x-reco-session, x-reco-path, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store'
};

function respond(body: object, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function uuid(value: string | null) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (!['GET', 'POST'].includes(request.method)) return respond({ error: 'Method not allowed' }, 405);
  if (!secret) return respond({ error: 'Server configuration error' }, 500);

  const syncKey = request.headers.get('X-Reco-Key');
  if (!syncKey || syncKey.length > 256) return respond({ error: 'Invalid key' }, 401);
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(syncKey));
    const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const admin = createClient(url, secret, { auth: { persistSession: false } });
    const { data: workspace, error: authError } = await admin.from('reco_workspaces')
      .select('id').eq('key_hash', hash).maybeSingle();
    if (authError) throw authError;
    if (!workspace) return respond({ error: 'Invalid key' }, 401);

    if (request.method === 'POST') {
      const sessionId = request.headers.get('X-Reco-Session');
      if (!uuid(sessionId)) return respond({ error: 'Invalid session' }, 400);
      const { data: session, error: sessionError } = await admin.from('reco_sessions')
        .select('id').eq('id', sessionId!).eq('workspace_id', workspace.id).maybeSingle();
      if (sessionError) throw sessionError;
      if (!session) return respond({ error: 'Session not synced' }, 404);
      if (request.headers.get('Content-Type') !== 'image/jpeg') return respond({ error: 'JPEG required' }, 415);
      const size = Number(request.headers.get('Content-Length') || 0);
      if (size > 5 * 1024 * 1024) return respond({ error: 'Image too large' }, 413);
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.length < 4 || bytes.length > 5 * 1024 * 1024 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff)
        return respond({ error: 'Invalid JPEG' }, 415);
      const path = `${workspace.id}/${sessionId}/${crypto.randomUUID()}.jpg`;
      const { error } = await admin.storage.from(bucket).upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      return respond({ path });
    }

    const path = request.headers.get('X-Reco-Path') || '';
    if (!new RegExp(`^${workspace.id}/[0-9a-f-]{36}/[0-9a-f-]{36}\\.jpg$`, 'i').test(path))
      return respond({ error: 'Invalid image path' }, 403);
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 600);
    if (error || !data) return respond({ error: 'Image not found' }, 404);
    return respond({ url: data.signedUrl });
  } catch (error) {
    console.error('Reco image request failed', error);
    return respond({ error: 'Image request failed' }, 500);
  }
});
