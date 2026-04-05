-- trips
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  destination TEXT,
  start_date TEXT,
  end_date TEXT,
  cover_emoji TEXT NOT NULL DEFAULT '✈️',
  color TEXT NOT NULL DEFAULT '#EC4899',
  description TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- trip_days
CREATE TABLE IF NOT EXISTS trip_days (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  date TEXT,
  day_label TEXT,
  theme TEXT,
  emoji TEXT NOT NULL DEFAULT '📅',
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- places
CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_id TEXT REFERENCES trip_days(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  time TEXT,
  name TEXT NOT NULL,
  detail TEXT,
  cat TEXT,
  map TEXT,
  pos_lat REAL,
  pos_lng REAL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- place_images
CREATE TABLE IF NOT EXISTS place_images (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- trip_members
CREATE TABLE IF NOT EXISTS trip_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  person_key TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🧡',
  color_hex TEXT NOT NULL DEFAULT '#8B5CF6',
  color_grad TEXT NOT NULL DEFAULT 'from-violet-500 to-purple-600',
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(trip_id, person_key)
);

-- checklist_cats
CREATE TABLE IF NOT EXISTS checklist_cats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- checklist_items
CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cat_id INTEGER NOT NULL REFERENCES checklist_cats(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- checklist_checks
CREATE TABLE IF NOT EXISTS checklist_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  person_key TEXT NOT NULL,
  item_id INTEGER NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  checked INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(trip_id, person_key, item_id)
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_places_trip ON places(trip_id);
CREATE INDEX IF NOT EXISTS idx_places_day ON places(day_id);
CREATE INDEX IF NOT EXISTS idx_trip_days_trip ON trip_days(trip_id);
CREATE INDEX IF NOT EXISTS idx_members_trip ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_images_place ON place_images(place_id);
CREATE INDEX IF NOT EXISTS idx_checks ON checklist_checks(trip_id, person_key);
