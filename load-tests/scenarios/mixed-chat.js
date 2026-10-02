import http from "k6/http";
import { check } from "k6";
import { BASE_URL, SEED_EMAIL, SEED_PASSWORD, RECEIVER_ID } from "../config/env.js";
import { jsonHeaders, parseJson } from "../helpers/http.js";
import { profile } from "../helpers/profiles.js";

const p = profile(__ENV.K6_PROFILE);
export const options = {
  scenarios: {
    mixed: { executor: "constant-vus", vus: p.vus, duration: p.duration },
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

  switch (__ITER % 4) {
    case 0: {
      const me = http.get(`${BASE_URL}/api/user/me`, { headers: jsonHeaders, tags: { endpoint: "me" } });
      check(me, { "me is 200": (r) => r.status === 200 });
      break;
    }
    case 1:
    case 2: {
      const messages = http.get(
        `${BASE_URL}/api/message/get/${RECEIVER_ID}?limit=50`,
        { headers: jsonHeaders, tags: { endpoint: "message_retrieval" } },
      );
      check(messages, {
        "message retrieval is 200": (r) => r.status === 200,
        "message retrieval returns data": (r) => Array.isArray(parseJson(r)?.data),
      });
      break;
    }
    default: {
      const send = http.post(
        `${BASE_URL}/api/message/send/${RECEIVER_ID}`,
        JSON.stringify({ message: `phase18 mixed vu=${__VU} iter=${__ITER}` }),
        { headers: jsonHeaders, tags: { endpoint: "message_send" } },
      );
      check(send, { "mixed send is 201": (r) => r.status === 201 });
    }
  }
}
