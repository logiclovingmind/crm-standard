CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','manager','agent')),
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','kn')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE leads (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('whatsapp','walk-in','99acres','magicbricks','referral','other')),
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New','Contacted','Site Visit','Negotiation','Closed','Lost')),
  requirement TEXT,
  conversation_summary TEXT,
  assigned_to INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_leads_status ON leads(status);

CREATE TABLE lead_activity (
  id INTEGER PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  user_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_activity_lead ON lead_activity(lead_id, created_at);

CREATE TABLE lead_notes (
  id INTEGER PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_notes_lead ON lead_notes(lead_id);

CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE units (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  identifier TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('1BHK','2BHK','3BHK','plot','villa')),
  area_sqft REAL,
  price REAL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','blocked','sold')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (project_id, identifier)
);

CREATE TABLE lead_units (
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  unit_id INTEGER NOT NULL REFERENCES units(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (lead_id, unit_id)
);

CREATE TABLE site_visits (
  id INTEGER PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  agent_id INTEGER REFERENCES users(id),
  project_id INTEGER REFERENCES projects(id),
  unit_id INTEGER REFERENCES units(id),
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','no-show','cancelled')),
  google_event_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_visits_agent ON site_visits(agent_id, scheduled_at);
CREATE INDEX idx_visits_lead ON site_visits(lead_id);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
