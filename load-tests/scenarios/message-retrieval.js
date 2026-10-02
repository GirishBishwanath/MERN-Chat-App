import http from "k6/http";
import { check } from "k6";
import { BASE_URL, requireReceiverId } from "../config/env.js";
import { parseJson } from "../helpers/http.js";
import { profile } from "../helpers/profiles.js";
import { authenticatedParams, loginOnce } from "../helpers/session.js";

const p = profile(__ENV.K6_PROFILE);

export const options = {
  scenarios: {
    retrieval: { executor: "constant-vus", vus: p.vus, duration: p.duration },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{endpoint:message_retrieval_first_page}": ["p(95)<1000"],
    "http_req_duration{endpoint:message_retrieval_cursor_page}": ["p(95)<1000"],
  },
};

export function setup() {
  return { cookie: loginOnce(), receiverId: requireReceiverId() };
}

export default function (data) {
  const first = http.get(
    BASE_URL + "/api/message/get/" + data.receiverId + "?limit=50",
    authenticatedParams(data.cookie, { endpoint: "message_retrieval_first_page" }),
  );
  check(first, {
    "first page is 200": (r) => r.status === 200,
    "first page returns data": (r) => Array.isArray(parseJson(r)?.data),
  });

  const nextCursor = parseJson(first)?.meta?.nextCursor;
  if (!nextCursor) return;

  const next = http.get(
    BASE_URL + "/api/message/get/" + data.receiverId + "?limit=50&cursor=" + encodeURIComponent(nextCursor),
    authenticatedParams(data.cookie, { endpoint: "message_retrieval_cursor_page" }),
  );
  check(next, {
    "cursor page is 200": (r) => r.status === 200,
    "cursor page returns data": (r) => Array.isArray(parseJson(r)?.data),
  });
}
