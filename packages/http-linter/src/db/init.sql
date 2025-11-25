CREATE TABLE IF NOT EXISTS http_request (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    origin TEXT NOT NULL,
    path TEXT NOT NULL,
    method TEXT NOT NULL,
    body_encoding TEXT,
    body TEXT
);

CREATE TABLE IF NOT EXISTS http_response (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status_code INTEGER NOT NULL,
    body TEXT,
    body_encoding TEXT,
    duration REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS http_transaction (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    response_id INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES http_request(id),
    FOREIGN KEY (response_id) REFERENCES http_response(id)
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
)
