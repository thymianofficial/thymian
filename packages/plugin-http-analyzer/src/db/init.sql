CREATE TABLE IF NOT EXISTS http_trace (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS communication_role (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS http_request (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    origin TEXT NOT NULL,
    path TEXT NOT NULL,
    method TEXT NOT NULL,
    body_encoding TEXT,
    body TEXT,
    role_id INTEGER,
    FOREIGN KEY (role_id) REFERENCES communication_role(id)
);

CREATE TABLE IF NOT EXISTS http_response (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status_code INTEGER NOT NULL,
    body TEXT,
    body_encoding TEXT,
    duration REAL NOT NULL,
    role_id INTEGER,
    FOREIGN KEY (role_id) REFERENCES communication_role(id)
);

CREATE TABLE IF NOT EXISTS http_transaction (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    response_id INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    trace_id INTEGER NOT NULL,
    parent_transaction_id INTEGER,
    FOREIGN KEY (request_id) REFERENCES http_request(id),
    FOREIGN KEY (response_id) REFERENCES http_response(id),
    FOREIGN KEY (trace_id) REFERENCES http_trace(id),
    FOREIGN KEY (parent_transaction_id) REFERENCES http_transaction(id)
);

CREATE TABLE IF NOT EXISTS http_request_header (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (request_id) REFERENCES http_request(id)
);

CREATE TABLE IF NOT EXISTS http_response_header (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     response_id INTEGER NOT NULL,
     name TEXT NOT NULL,
     value TEXT NOT NULL,
     FOREIGN KEY (response_id) REFERENCES http_response(id)
);

CREATE TABLE IF NOT EXISTS http_response_trailer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    response_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (response_id) REFERENCES http_response(id)
);

CREATE TABLE IF NOT EXISTS http_request_query_parameter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (request_id) REFERENCES http_request(id)
);

INSERT OR IGNORE INTO communication_role (name) VALUES
  ('intermediary'),
  ('proxy'),
  ('gateway'),
  ('tunnel'),
  ('origin server'),
  ('server'),
  ('client'),
  ('user-agent'),
  ('cache');
