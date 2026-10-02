import http from "k6/http";
import { check } from "k6";
import { BASE_URL, SEED_EMAIL, SEED_PASSWORD, RECEIVER_ID } from "../config/env.js";
import { jsonHeaders, parseJson } from "../helpers/http.js";
import { profile } from "../helpers/profiles.js";

const p = profile(__ENV.K6_PROFILE);
export const options = {
  scenarios: {
    retrieval: { executor: "constant-vus", vus: p.vus, duration: p.duration },
  },
  thresholds: { http_req_failed: ["rate<0.02"] },
};

export default function () {
  if (!RECEIVER_ID) return;

  const login = http.post(
    `${BASE_URL}/api/user/login`,
    JSON.stringify({ email: SEED_EMAIL, password: SEED_PASSWORD }),
    { headers: jsonHeaders, tags: { endpoint: "login" } },
  );
  if (login.status !== 200) return;

  const first = http.get(
    `${BASE_URL}/api/message/get/${RECEIVER_ID}?limit=50`,
    { headers: jsonHeaders, tags: { endpoint: "message_retrieval_first_page" } },
  );
  check(first, {
    "first page is 200": (r) => r.status === 200,
    "first page returns data": (r) => Array.isArray(parseJson(r)?.data),
  });

  const firstBody = parseJson(first);
  if (!firstBody?.meta?.nextCursor) return;

  const next = http.get(
    `${BASE_URL}/api/message/get/${RECEIVER_ID}?limit=50&cursor=${encodeURIComponent(firstBody.meta.nextCursor)}`,
    { headers: jsonHeaders, tags: { endpoint: "message_retrieval_cursor_page" } },
  );
  check(next, {
    "cursor page is 200": (r) => r.status === 200,
    "cursor page returns data": (r) => Array.isArray(parseJson(r)?.data),
  });
}
