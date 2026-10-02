import http from "k6/http";
import { check, fail } from "k6";
import { BASE_URL, SEED_EMAIL, SEED_PASSWORD, TEST_ORIGIN } from "../config/env.js";

export function loginOnce() {
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

  check(response, { "benchmark login succeeds": (r) => r.status === 200 });
  if (response.status !== 200) {
    fail("benchmark session bootstrap failed");
  }

  const cookies = response.cookies;
  const cookieHeader = Object.entries(cookies)
    .flatMap(([name, values]) => values.map((entry) => name + "=" + entry.value))
    .join("; ");

  if (!cookieHeader) {
    fail("benchmark login did not return an authentication cookie");
  }

  return cookieHeader;
}

export function authenticatedParams(cookieHeader, tags) {
  return {
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Cookie: cookieHeader,
    },
    tags,
  };
}
