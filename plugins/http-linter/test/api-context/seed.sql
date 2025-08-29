BEGIN TRANSACTION;

INSERT INTO http_request (origin, path, method, body_encoding, body)
VALUES ('https://api.example.com', '/users', 'HEAD', NULL, NULL);
INSERT INTO http_response (status_code, body, body_encoding, duration)
VALUES (200, '[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]', 'utf-8', 123.4);
INSERT INTO http_transaction (request_id, response_id)
VALUES ((SELECT id FROM http_request ORDER BY id DESC LIMIT 1),
        (SELECT id FROM http_response ORDER BY id DESC LIMIT 1));
INSERT INTO http_response_header (response_id, name, value)
VALUES ((SELECT id FROM http_response ORDER BY id DESC LIMIT 1), 'Content-Type', 'application/json');
INSERT INTO http_response_header (response_id, name, value)
VALUES ((SELECT id FROM http_response ORDER BY id DESC LIMIT 1), 'ETag', '"abc123"');

INSERT INTO http_request (origin, path, method, body_encoding, body)
VALUES ('https://api.example.com', '/search', 'HEAD', NULL, NULL);
INSERT INTO http_request_query_parameter (request_id, name, value)
VALUES ((SELECT id FROM http_request ORDER BY id DESC LIMIT 1), 'q', 'thymian');
INSERT INTO http_response (status_code, body, body_encoding, duration)
VALUES (200, '{"results":[{"id":42,"title":"ChatGPT Guide"}]}', 'utf-8', 98.7);
INSERT INTO http_transaction (request_id, response_id)
VALUES ((SELECT id FROM http_request ORDER BY id DESC LIMIT 1),
        (SELECT id FROM http_response ORDER BY id DESC LIMIT 1));
INSERT INTO http_response_header (response_id, name, value)
VALUES ((SELECT id FROM http_response ORDER BY id DESC LIMIT 1), 'Content-Type', 'application/json');
INSERT INTO http_response_header (response_id, name, value)
VALUES ((SELECT id FROM http_response ORDER BY id DESC LIMIT 1), 'ETag', '"def456"');

INSERT INTO http_request (origin, path, method, body_encoding, body)
VALUES ('https://api.example.com', '/status', 'GET', NULL, NULL);
INSERT INTO http_response (status_code, body, body_encoding, duration)
VALUES (200, '{"status":"ok"}', 'utf-8', 45.2);
INSERT INTO http_transaction (request_id, response_id)
VALUES ((SELECT id FROM http_request ORDER BY id DESC LIMIT 1),
        (SELECT id FROM http_response ORDER BY id DESC LIMIT 1));
INSERT INTO http_response_header (response_id, name, value)
VALUES ((SELECT id FROM http_response ORDER BY id DESC LIMIT 1), 'Content-Type', 'application/json');

COMMIT;
