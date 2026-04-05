const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function nanoid() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      // ── 여행 ──
      // GET /api/trips
      if (method === 'GET' && path === '/api/trips') {
        const rows = await env.DB.prepare(`
          SELECT t.*,
            (SELECT COUNT(*) FROM places p WHERE p.trip_id = t.id) AS place_count,
            (SELECT COUNT(*) FROM trip_days d WHERE d.trip_id = t.id) AS day_count
          FROM trips t
          ORDER BY t.sort_order ASC, t.created_at DESC
        `).all();
        return json(rows.results);
      }

      // POST /api/trips
      if (method === 'POST' && path === '/api/trips') {
        const body = await request.json();
        const id = nanoid();
        await env.DB.prepare(`
          INSERT INTO trips (id, name, destination, start_date, end_date, cover_emoji, color, description)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          body.name || '',
          body.destination || null,
          body.start_date || null,
          body.end_date || null,
          body.cover_emoji || '✈️',
          body.color || '#EC4899',
          body.description || null
        ).run();
        const trip = await env.DB.prepare('SELECT * FROM trips WHERE id = ?').bind(id).first();
        return json({ ...trip, place_count: 0, day_count: 0 });
      }

      // GET /api/trips/:tripId
      const tripMatch = path.match(/^\/api\/trips\/([^/]+)$/);
      if (tripMatch) {
        const tripId = tripMatch[1];
        if (method === 'GET') {
          const trip = await env.DB.prepare('SELECT * FROM trips WHERE id = ?').bind(tripId).first();
          if (!trip) return json({ error: 'Not found' }, 404);
          return json(trip);
        }
        if (method === 'PUT') {
          const body = await request.json();
          await env.DB.prepare(`
            UPDATE trips SET name=?, destination=?, start_date=?, end_date=?, cover_emoji=?, color=?, description=?
            WHERE id=?
          `).bind(
            body.name,
            body.destination || null,
            body.start_date || null,
            body.end_date || null,
            body.cover_emoji || '✈️',
            body.color || '#EC4899',
            body.description || null,
            tripId
          ).run();
          const trip = await env.DB.prepare('SELECT * FROM trips WHERE id = ?').bind(tripId).first();
          return json(trip);
        }
        if (method === 'DELETE') {
          await env.DB.prepare('DELETE FROM trips WHERE id = ?').bind(tripId).run();
          return json({ ok: true });
        }
      }

      // PATCH /api/trips/:tripId/archive
      const archiveMatch = path.match(/^\/api\/trips\/([^/]+)\/archive$/);
      if (archiveMatch && method === 'PATCH') {
        const tripId = archiveMatch[1];
        await env.DB.prepare('UPDATE trips SET is_archived = CASE WHEN is_archived=1 THEN 0 ELSE 1 END WHERE id=?').bind(tripId).run();
        const trip = await env.DB.prepare('SELECT * FROM trips WHERE id = ?').bind(tripId).first();
        return json(trip);
      }

      // ── 날짜 ──
      // GET/POST /api/trips/:tripId/days
      const daysMatch = path.match(/^\/api\/trips\/([^/]+)\/days$/);
      if (daysMatch) {
        const tripId = daysMatch[1];
        if (method === 'GET') {
          const days = await env.DB.prepare(
            'SELECT * FROM trip_days WHERE trip_id=? ORDER BY sort_order ASC, rowid ASC'
          ).bind(tripId).all();
          const places = await env.DB.prepare(
            'SELECT * FROM places WHERE trip_id=? ORDER BY sort_order ASC, created_at ASC'
          ).bind(tripId).all();
          const result = days.results.map(d => ({
            ...d,
            places: places.results.filter(p => p.day_id === d.id),
          }));
          return json(result);
        }
        if (method === 'POST') {
          const body = await request.json();
          const id = nanoid();
          await env.DB.prepare(`
            INSERT INTO trip_days (id, trip_id, date, day_label, theme, emoji, color, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            id, tripId,
            body.date || null,
            body.day_label || null,
            body.theme || null,
            body.emoji || '📅',
            body.color || null,
            body.sort_order ?? 0
          ).run();
          const day = await env.DB.prepare('SELECT * FROM trip_days WHERE id=?').bind(id).first();
          return json(day);
        }
      }

      // PUT/DELETE /api/trips/:tripId/days/:dayId
      const dayMatch = path.match(/^\/api\/trips\/([^/]+)\/days\/([^/]+)$/);
      if (dayMatch) {
        const [, tripId, dayId] = dayMatch;
        if (method === 'PUT') {
          const body = await request.json();
          await env.DB.prepare(`
            UPDATE trip_days SET date=?, day_label=?, theme=?, emoji=?, color=?, sort_order=?
            WHERE id=? AND trip_id=?
          `).bind(
            body.date || null,
            body.day_label || null,
            body.theme || null,
            body.emoji || '📅',
            body.color || null,
            body.sort_order ?? 0,
            dayId, tripId
          ).run();
          const day = await env.DB.prepare('SELECT * FROM trip_days WHERE id=?').bind(dayId).first();
          return json(day);
        }
        if (method === 'DELETE') {
          await env.DB.prepare('DELETE FROM trip_days WHERE id=? AND trip_id=?').bind(dayId, tripId).run();
          return json({ ok: true });
        }
      }

      // ── 장소 ──
      // GET/POST /api/trips/:tripId/places
      const placesMatch = path.match(/^\/api\/trips\/([^/]+)\/places$/);
      if (placesMatch) {
        const tripId = placesMatch[1];
        if (method === 'GET') {
          const places = await env.DB.prepare(
            'SELECT * FROM places WHERE trip_id=? ORDER BY day_id, sort_order ASC'
          ).bind(tripId).all();
          return json(places.results);
        }
        if (method === 'POST') {
          const body = await request.json();
          const id = nanoid();
          const sortRow = await env.DB.prepare(
            'SELECT COUNT(*) as cnt FROM places WHERE day_id=?'
          ).bind(body.day_id || null).first();
          const sortOrder = (sortRow?.cnt ?? 0);
          await env.DB.prepare(`
            INSERT INTO places (id, trip_id, day_id, sort_order, time, name, detail, cat, map, pos_lat, pos_lng)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            id, tripId,
            body.day_id || null,
            sortOrder,
            body.time || null,
            body.name || '',
            body.detail || null,
            body.cat || null,
            body.map || null,
            body.pos_lat ?? null,
            body.pos_lng ?? null
          ).run();
          const place = await env.DB.prepare('SELECT * FROM places WHERE id=?').bind(id).first();
          return json(place);
        }
      }

      // PUT/DELETE /api/places/:placeId
      const placeMatch = path.match(/^\/api\/places\/([^/]+)$/);
      if (placeMatch) {
        const placeId = placeMatch[1];
        if (method === 'PUT') {
          const body = await request.json();
          await env.DB.prepare(`
            UPDATE places SET time=?, name=?, detail=?, cat=?, map=?, pos_lat=?, pos_lng=?, day_id=?, sort_order=?
            WHERE id=?
          `).bind(
            body.time || null,
            body.name || '',
            body.detail || null,
            body.cat || null,
            body.map || null,
            body.pos_lat ?? null,
            body.pos_lng ?? null,
            body.day_id || null,
            body.sort_order ?? 0,
            placeId
          ).run();
          const place = await env.DB.prepare('SELECT * FROM places WHERE id=?').bind(placeId).first();
          return json(place);
        }
        if (method === 'DELETE') {
          await env.DB.prepare('DELETE FROM places WHERE id=?').bind(placeId).run();
          return json({ ok: true });
        }
      }

      // ── 이미지 ──
      // GET/POST /api/places/:placeId/images
      const imagesMatch = path.match(/^\/api\/places\/([^/]+)\/images$/);
      if (imagesMatch) {
        const placeId = imagesMatch[1];
        if (method === 'GET') {
          const imgs = await env.DB.prepare(
            'SELECT * FROM place_images WHERE place_id=? ORDER BY created_at ASC'
          ).bind(placeId).all();
          return json(imgs.results);
        }
        if (method === 'POST') {
          const body = await request.json();
          const id = nanoid();
          await env.DB.prepare(`
            INSERT INTO place_images (id, place_id, trip_id, filename, data)
            VALUES (?, ?, ?, ?, ?)
          `).bind(id, placeId, body.trip_id || null, body.filename || '', body.data || '').run();
          const img = await env.DB.prepare('SELECT id, place_id, trip_id, filename, created_at FROM place_images WHERE id=?').bind(id).first();
          return json({ ...img, data: body.data });
        }
      }

      // DELETE /api/images/:imageId
      const imageMatch = path.match(/^\/api\/images\/([^/]+)$/);
      if (imageMatch && method === 'DELETE') {
        const imageId = imageMatch[1];
        await env.DB.prepare('DELETE FROM place_images WHERE id=?').bind(imageId).run();
        return json({ ok: true });
      }

      // ── 멤버 ──
      // GET/POST /api/trips/:tripId/members
      const membersMatch = path.match(/^\/api\/trips\/([^/]+)\/members$/);
      if (membersMatch) {
        const tripId = membersMatch[1];
        if (method === 'GET') {
          const members = await env.DB.prepare(
            'SELECT * FROM trip_members WHERE trip_id=? ORDER BY sort_order ASC, id ASC'
          ).bind(tripId).all();
          return json(members.results);
        }
        if (method === 'POST') {
          const body = await request.json();
          const sortRow = await env.DB.prepare(
            'SELECT COUNT(*) as cnt FROM trip_members WHERE trip_id=?'
          ).bind(tripId).first();
          const sortOrder = sortRow?.cnt ?? 0;
          await env.DB.prepare(`
            INSERT INTO trip_members (trip_id, person_key, emoji, color_hex, color_grad, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            tripId,
            body.person_key || '',
            body.emoji || '🧡',
            body.color_hex || '#8B5CF6',
            body.color_grad || 'from-violet-500 to-purple-600',
            sortOrder
          ).run();
          const member = await env.DB.prepare(
            'SELECT * FROM trip_members WHERE trip_id=? AND person_key=? ORDER BY id DESC LIMIT 1'
          ).bind(tripId, body.person_key).first();
          return json(member);
        }
      }

      // PUT/DELETE /api/trips/:tripId/members/:memberId
      const memberMatch = path.match(/^\/api\/trips\/([^/]+)\/members\/([^/]+)$/);
      if (memberMatch) {
        const [, tripId, memberId] = memberMatch;
        if (method === 'PUT') {
          const body = await request.json();
          await env.DB.prepare(`
            UPDATE trip_members SET person_key=?, emoji=?, color_hex=?, color_grad=?
            WHERE id=? AND trip_id=?
          `).bind(
            body.person_key || '',
            body.emoji || '🧡',
            body.color_hex || '#8B5CF6',
            body.color_grad || 'from-violet-500 to-purple-600',
            memberId, tripId
          ).run();
          const member = await env.DB.prepare('SELECT * FROM trip_members WHERE id=?').bind(memberId).first();
          return json(member);
        }
        if (method === 'DELETE') {
          await env.DB.prepare('DELETE FROM trip_members WHERE id=? AND trip_id=?').bind(memberId, tripId).run();
          return json({ ok: true });
        }
      }

      // ── 체크리스트 ──
      // GET /api/trips/:tripId/checklist
      const checklistMatch = path.match(/^\/api\/trips\/([^/]+)\/checklist$/);
      if (checklistMatch && method === 'GET') {
        const tripId = checklistMatch[1];
        const cats = await env.DB.prepare(
          'SELECT * FROM checklist_cats WHERE trip_id=? ORDER BY sort_order ASC, id ASC'
        ).bind(tripId).all();
        const items = await env.DB.prepare(`
          SELECT ci.* FROM checklist_items ci
          JOIN checklist_cats cc ON ci.cat_id = cc.id
          WHERE cc.trip_id=?
          ORDER BY ci.sort_order ASC, ci.id ASC
        `).bind(tripId).all();
        const checks = await env.DB.prepare(
          'SELECT * FROM checklist_checks WHERE trip_id=?'
        ).bind(tripId).all();

        const catsWithItems = cats.results.map(c => ({
          ...c,
          items: items.results.filter(i => i.cat_id === c.id),
        }));

        const checksMap = {};
        for (const ch of checks.results) {
          if (!checksMap[ch.person_key]) checksMap[ch.person_key] = {};
          checksMap[ch.person_key][ch.item_id] = ch.checked === 1;
        }

        return json({ cats: catsWithItems, checks: checksMap });
      }

      // POST /api/trips/:tripId/checklist/cats
      const checklistCatsMatch = path.match(/^\/api\/trips\/([^/]+)\/checklist\/cats$/);
      if (checklistCatsMatch && method === 'POST') {
        const tripId = checklistCatsMatch[1];
        const body = await request.json();
        const sortRow = await env.DB.prepare(
          'SELECT COUNT(*) as cnt FROM checklist_cats WHERE trip_id=?'
        ).bind(tripId).first();
        const sortOrder = sortRow?.cnt ?? 0;
        const result = await env.DB.prepare(
          'INSERT INTO checklist_cats (trip_id, name, sort_order) VALUES (?, ?, ?)'
        ).bind(tripId, body.name || '', sortOrder).run();
        const cat = await env.DB.prepare('SELECT * FROM checklist_cats WHERE id=?').bind(result.meta.last_row_id).first();
        return json(cat);
      }

      // PUT /api/checklist/cats/:catId
      const catMatch = path.match(/^\/api\/checklist\/cats\/([^/]+)$/);
      if (catMatch) {
        const catId = catMatch[1];
        if (method === 'PUT') {
          const body = await request.json();
          await env.DB.prepare('UPDATE checklist_cats SET name=? WHERE id=?').bind(body.name || '', catId).run();
          const cat = await env.DB.prepare('SELECT * FROM checklist_cats WHERE id=?').bind(catId).first();
          return json(cat);
        }
        if (method === 'DELETE') {
          await env.DB.prepare('DELETE FROM checklist_cats WHERE id=?').bind(catId).run();
          return json({ ok: true });
        }
      }

      // POST /api/checklist/cats/:catId/items
      const catItemsMatch = path.match(/^\/api\/checklist\/cats\/([^/]+)\/items$/);
      if (catItemsMatch && method === 'POST') {
        const catId = catItemsMatch[1];
        const body = await request.json();
        const sortRow = await env.DB.prepare(
          'SELECT COUNT(*) as cnt FROM checklist_items WHERE cat_id=?'
        ).bind(catId).first();
        const sortOrder = sortRow?.cnt ?? 0;
        const result = await env.DB.prepare(
          'INSERT INTO checklist_items (cat_id, text, sort_order) VALUES (?, ?, ?)'
        ).bind(catId, body.text || '', sortOrder).run();
        const item = await env.DB.prepare('SELECT * FROM checklist_items WHERE id=?').bind(result.meta.last_row_id).first();
        return json(item);
      }

      // PUT/DELETE /api/checklist/items/:itemId
      const itemMatch = path.match(/^\/api\/checklist\/items\/([^/]+)$/);
      if (itemMatch) {
        const itemId = itemMatch[1];
        if (method === 'PUT') {
          const body = await request.json();
          await env.DB.prepare('UPDATE checklist_items SET text=? WHERE id=?').bind(body.text || '', itemId).run();
          const item = await env.DB.prepare('SELECT * FROM checklist_items WHERE id=?').bind(itemId).first();
          return json(item);
        }
        if (method === 'DELETE') {
          await env.DB.prepare('DELETE FROM checklist_items WHERE id=?').bind(itemId).run();
          return json({ ok: true });
        }
      }

      // POST /api/trips/:tripId/checklist/check
      const checkMatch = path.match(/^\/api\/trips\/([^/]+)\/checklist\/check$/);
      if (checkMatch && method === 'POST') {
        const tripId = checkMatch[1];
        const body = await request.json();
        await env.DB.prepare(`
          INSERT INTO checklist_checks (trip_id, person_key, item_id, checked, updated_at)
          VALUES (?, ?, ?, ?, unixepoch())
          ON CONFLICT(trip_id, person_key, item_id) DO UPDATE SET checked=excluded.checked, updated_at=unixepoch()
        `).bind(tripId, body.person_key, body.item_id, body.checked ?? 1).run();
        return json({ ok: true });
      }

      // 정적 파일 폴백
      return env.ASSETS.fetch(request);

    } catch (e) {
      console.error(e);
      return json({ error: e.message }, 500);
    }
  },
};
