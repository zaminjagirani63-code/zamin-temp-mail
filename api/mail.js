
const BASE = "https://grabmail.io/api/v1";
const ALLOWED_DOMAINS = ["grabmail.io", "mixozia.com", "linqmail.com"];

function validAddress(address) {
  if (typeof address !== "string") return false;
  const parts = address.toLowerCase().split("@");
  return parts.length === 2 &&
    /^[a-z0-9._-]+$/.test(parts[0]) &&
    ALLOWED_DOMAINS.includes(parts[1]);
}

function sendJson(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

module.exports = async (req, res) => {
  try {
    const { action, address, id } = req.query || {};

    if (!validAddress(address)) {
      return sendJson(res, 400, { error: "invalid_address", message: "Invalid email address." });
    }

    let url;
    let method = "GET";

    if (action === "inbox" && req.method === "GET") {
      url = `${BASE}/mailbox?address=${encodeURIComponent(address)}`;
    } else if (action === "read" && req.method === "GET") {
      if (typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        return sendJson(res, 400, { error: "invalid_id", message: "Invalid message ID." });
      }
      url = `${BASE}/message/${encodeURIComponent(id)}?mailbox=${encodeURIComponent(address)}`;
    } else if (action === "delete" && req.method === "DELETE") {
      if (typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        return sendJson(res, 400, { error: "invalid_id", message: "Invalid message ID." });
      }
      url = `${BASE}/message/${encodeURIComponent(id)}?mailbox=${encodeURIComponent(address)}`;
      method = "DELETE";
    } else {
      return sendJson(res, 405, { error: "method_not_allowed", message: "Unsupported action or method." });
    }

    const upstream = await fetch(url, {
      method,
      headers: { "Accept": "application/json" }
    });

    const body = await upstream.text();

    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");

    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) res.setHeader("Retry-After", retryAfter);

    return res.end(body);
  } catch (error) {
    return sendJson(res, 500, {
      error: "server_error",
      message: "Unable to contact the email service. Please try again."
    });
  }
};
