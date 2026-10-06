import http from "k6/http";
import { check } from "k6";
import { BASE_URL, SEED_EMAIL, SEED_PASSWORD, TEST_ORIGIN } from "../config/env.js";
import { profile } from "../helpers/profiles.js";

const p = profile(__ENV.K6_PROFILE);

export const options = {
  scenarios: {
    login: {
      executor: "per-vu-iterations",
      vus: p.authVus,
      iterations: 1,
      maxDuration: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

export default function () {
  const response = http.post(
    BASE_URL + "/api/user/login",
    JSON.stringify({ email: SEED_EMAIL, password: SEED_PASSWORD }),
    {
      headers: {
        "Content-Type": "application/json",
        Origin: TEST_ORIGIN,
      },
      tags: { endpoint: "login" },
    },
  );

  check(response, {
    "login status is 200": (r) => r.status === 200,
    "login returns user": (r) => Boolean(r.json()?.user?._id),
  });
}
