import http from "k6/http";
import { check } from "k6";
import { BASE_URL, requireReceiverId } from "../config/env.js";
import { parseJson } from "../helpers/http.js";
import { profile } from "../helpers/profiles.js";
import { authenticatedParams, loginOnce } from "../helpers/session.js";

const p = profile(__ENV.K6_PROFILE);

export const options = {
  scenarios: {
    mixed: { executor: "constant-vus", vus: p.vus, duration: p.duration },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

export function setup() {
  return { cookie: loginOnce(), receiverId: requireReceiverId() };
}

export default function (data) {
  switch (__ITER % 4) {
    case 0: {
      const me = http.get(
        BASE_URL + "/api/user/me",
        authenticatedParams(data.cookie, { endpoint: "me" }),
      );
      check(me, { "me is 200": (r) => r.status === 200 });
      break;
    }
    case 1:
    case 2: {
      const messages = http.get(
        BASE_URL + "/api/message/get/" + data.receiverId + "?limit=50",
        authenticatedParams(data.cookie, { endpoint: "message_retrieval" }),
      );
      check(messages, {
        "message retrieval is 200": (r) => r.status === 200,
        "message retrieval returns data": (r) => Array.isArray(parseJson(r)?.data),
      });
      break;
    }
    default: {
      const send = http.post(
        BASE_URL + "/api/message/send/" + data.receiverId,
        JSON.stringify({ message: "phase18 mixed vu=" + __VU + " iter=" + __ITER }),
        authenticatedParams(data.cookie, { endpoint: "message_send" }),
      );
      check(send, { "mixed send is 201": (r) => r.status === 201 });
    }
  }
}
