import http from "k6/http";
import { check } from "k6";
import { BASE_URL, SEED_EMAIL, SEED_PASSWORD, RECEIVER_ID, SEND_MESSAGE_PREFIX } from "../config/env.js";
import { jsonHeaders, parseJson } from "../helpers/http.js";
import { profile } from "../helpers/profiles.js";

const p = profile(__ENV.K6_PROFILE);
export const options = {
  scenarios: {
    send: { executor: "constant-vus", vus: p.vus, duration: p.duration },
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

  const response = http.post(
    `${BASE_URL}/api/message/send/${RECEIVER_ID}`,
    JSON.stringify({ message: `${SEND_MESSAGE_PREFIX} vu=${__VU} iter=${__ITER}` }),
    { headers: jsonHeaders, tags: { endpoint: "message_send" } },
  );
  check(response, {
    "message send is 201": (r) => r.status === 201,
    "message send returns data": (r) => Boolean(parseJson(r)?.data?._id),
  });
}
