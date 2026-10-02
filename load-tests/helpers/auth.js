import http from "k6/http";
import { check } from "k6";
import { BASE_URL, SEED_EMAIL, SEED_PASSWORD } from "../config/env.js";

export function authenticate() {
  const jar = new http.CookieJar();
  const response = http.post(
    BASE_URL + "/api/user/login",
    JSON.stringify({ email: SEED_EMAIL, password: SEED_PASSWORD }),
    {
      jar,
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3001",
      },
      tags: { endpoint: "login" },
    },
  );

  check(response, { "login status is 200": (r) => r.status === 200 });
  return { jar, ok: response.status === 200 };
}
