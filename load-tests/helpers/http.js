import http from "k6/http";
import { check, fail } from "k6";

export const jsonHeaders = {
  "Content-Type": "application/json",
  Origin: "http://localhost:3001",
};

export function parseJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

export function expectStatus(response, expected, label) {
  check(response, { [label]: (res) => res.status === expected });
  if (response.status !== expected) {
    fail(`${label}: expected ${expected}, received ${response.status}`);
  }
}

export function loginAndGetUser(baseUrl, email, password) {
  const response = http.post(
    `${baseUrl}/api/user/login`,
    JSON.stringify({ email, password }),
    { headers: jsonHeaders, tags: { endpoint: "login" } },
  );
  expectStatus(response, 200, "login succeeds");
  const body = parseJson(response);
  if (!body?.user?._id) fail("login response did not contain a user id");
  return body.user._id;
}
