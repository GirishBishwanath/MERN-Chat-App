import http from "k6/http";
import { check } from "k6";
import { BASE_URL, requireReceiverId, SEND_MESSAGE_PREFIX } from "../config/env.js";
import { parseJson } from "../helpers/http.js";
import { profile } from "../helpers/profiles.js";
import { authenticatedParams, loginOnce } from "../helpers/session.js";

const p = profile(__ENV.K6_PROFILE);

export const options = {
  scenarios: {
    send: { executor: "constant-vus", vus: p.vus, duration: p.duration },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{endpoint:message_send}": ["p(95)<1000"],
  },
};

export function setup() {
  return { cookie: loginOnce(), receiverId: requireReceiverId() };
}

export default function (data) {
  const response = http.post(
    BASE_URL + "/api/message/send/" + data.receiverId,
    JSON.stringify({ message: SEND_MESSAGE_PREFIX + " vu=" + __VU + " iter=" + __ITER }),
    authenticatedParams(data.cookie, { endpoint: "message_send" }),
  );

  check(response, {
    "message send is 201": (r) => r.status === 201,
    "message send returns data": (r) => Boolean(parseJson(r)?.data?._id),
  });
}
