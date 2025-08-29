export const insertRequestHeader = `INSERT INTO http_request_header (name, value, request_id) VALUES (@name, @value, @id);`;

export const insertResponseHeader = `INSERT INTO http_response_header (name, value, response_id) VALUES (@name, @value, @id);`;

export const insertResponseTrailer = `INSERT INTO http_response_trailer (name, value, response_id) VALUES (@name, @value, @id);`;

export const insertHttpRequest = `INSERT INTO http_request (origin, path, method, body_encoding, body) VALUES (@origin, @path, @method, @bodyEncoding, @body)`;

export const insertHttpResponse = `INSERT INTO http_response (status_code, body, body_encoding, duration) VALUES (@statusCode, @body, @bodyEncoding, @duration)`;

export const insertHttpTransaction = `INSERT INTO http_transaction (request_id, response_id) VALUES (?, ?)`;

export const insertRequestQueryParameter = `INSERT INTO http_request_query_parameter (name, value, request_id) VALUES (@name, @value, @id);`;
