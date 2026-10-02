import http from "k6/http";
import { check } from "k6";
import { BASE_URL, SEED_EMAIL, SEED_PASSWORD } from "../config/env.js";
import { jsonHeaders, parseJson } from "../helpers/http.js";
import { profile } from "../helpers/profiles.js";

const p = profile(__ENV.K6_PROFILE);
export const options = {
  scenarios: {
    auth: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: `${p.ramp}s`, target: p.vus },
        { duration: p.duration, target: p.vus },
        { duration: `${p.ramp}s`, target: 0 },
      ],
    },
  },
  thresholds: { http_req_failed: ["rate<0.05"] },
};

export default function () {
  const login = http.post(
    `${BASE_URL}/api/user/login`,
    JSON.stringify({ email: SEED_EMAIL, password: SEED_PASSWORD }),
    { headers: jsonHeaders, tags: { endpoint: "login" } },
  );
  check(login, { "login status is 200": (r) => r.status === 200 });
  if (login.status !== 200) return;

  const me = http.get(`${BASE_URL}/api/user/me`, {
    headers: jsonHeaders,
    tags: { endpoint: "me" },
  });
  const body = parseJson(me);
  check(me, {
    "me status is 200": (r) => r.status === 200,
    "me returns a user": () => Boolean(body?.user?._id),
  });
}
