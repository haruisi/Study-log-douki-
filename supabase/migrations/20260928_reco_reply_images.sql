-- Keep images in a private bucket; only the reco-images Edge Function uses the server key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reco-reply-images', 'reco-reply-images', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

alter table public.reco_replies add column if not exists image_path text;

create or replace function public.reco_pull(p_key text)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  ws uuid;
  sessions_json jsonb;
  logs_json jsonb;
begin
  select id into ws from public.reco_workspaces where key_hash = public.reco_key_hash(p_key);
  if ws is null then return null; end if;

  select coalesce(jsonb_agg(session_json order by started_at desc), '[]'::jsonb)
  into sessions_json
  from (
    select s.started_at,
      jsonb_build_object(
        'id', s.id, 'startedAt', s.started_at, 'endedAt', s.ended_at,
        'subject', s.subject, 'resource', s.resource, 'note', s.note,
        'createdAt', s.created_at,
        'replies', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', r.id, 'content', r.content, 'imagePath', r.image_path,
            'createdAt', r.created_at
          ) order by r.created_at)
          from public.reco_replies r
          where r.workspace_id = ws and r.session_id = s.id
        ), '[]'::jsonb)
      ) as session_json
    from public.reco_sessions s where s.workspace_id = ws
  ) q;

  select coalesce(jsonb_agg(log_json order by recorded_at desc), '[]'::jsonb)
  into logs_json
  from (
    select l.recorded_at,
      jsonb_build_object(
        'id', l.id, 'recordedAt', l.recorded_at, 'subject', l.subject,
        'resource', l.resource, 'content', l.content, 'note', l.note,
        'createdAt', l.created_at
      ) as log_json
    from public.reco_logs l where l.workspace_id = ws
  ) q;

  return jsonb_build_object('sessions', sessions_json, 'logs', logs_json);
end;
$function$;

create or replace function public.reco_upsert_session(p_key text, p_session jsonb)
returns boolean language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  ws uuid;
  sid uuid;
  rep jsonb;
  path text;
begin
  select id into ws from public.reco_workspaces where key_hash = public.reco_key_hash(p_key);
  if ws is null then raise exception 'Invalid sync key'; end if;
  sid := (p_session->>'id')::uuid;

  insert into public.reco_sessions(
    id, workspace_id, started_at, ended_at, subject, resource, note, created_at, updated_at
  ) values (
    sid, ws, (p_session->>'startedAt')::timestamptz,
    nullif(p_session->>'endedAt','')::timestamptz,
    coalesce(p_session->>'subject','その他'), coalesce(p_session->>'resource',''),
    coalesce(p_session->>'note',''),
    coalesce(nullif(p_session->>'createdAt','')::timestamptz, now()), now()
  ) on conflict (id) do update set
    started_at = excluded.started_at, ended_at = excluded.ended_at,
    subject = excluded.subject, resource = excluded.resource,
    note = excluded.note, updated_at = now()
  where public.reco_sessions.workspace_id = ws;

  if coalesce(jsonb_typeof(p_session->'replies'), '') = 'array' then
    for rep in select value from jsonb_array_elements(p_session->'replies') loop
      path := nullif(rep->>'imagePath', '');
      if path is not null and path not like (ws::text || '/' || sid::text || '/%.jpg') then
        raise exception 'Invalid image path';
      end if;
      insert into public.reco_replies(id, workspace_id, session_id, content, image_path, created_at)
      values (
        (rep->>'id')::uuid, ws, sid, coalesce(rep->>'content',''), path,
        coalesce(nullif(rep->>'createdAt','')::timestamptz, now())
      ) on conflict (id) do update set
        content = excluded.content,
        image_path = coalesce(excluded.image_path, public.reco_replies.image_path)
      where public.reco_replies.workspace_id = ws and public.reco_replies.session_id = sid;
    end loop;
  end if;
  return true;
end;
$function$;
