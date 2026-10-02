import { check } from "k6";
import { WebSocket } from "k6/websockets";
import { BASE_URL } from "../config/env.js";
import { profile } from "../helpers/profiles.js";

const p = profile(__ENV.K6_PROFILE);
const wsUrl = BASE_URL.replace(/^http/, "ws") + "/socket.io/?EIO=4&transport=websocket";

export const options = {
  scenarios: {
    websocket: { executor: "constant-vus", vus: p.vus, duration: p.duration },
  },
  thresholds: { ws_connecting: ["p(95)<2000"] },
};

export default function () {
  const cookie = __ENV.K6_COOKIE;
  if (!cookie) return;

  const ws = new WebSocket(wsUrl, null, {
    headers: { Cookie: cookie, Origin: "http://localhost:3001" },
  });

  let opened = false;
  ws.onopen = () => {
    opened = true;
    ws.send("2");
    ws.setTimeout(() => ws.close(), 5000);
  };
  ws.onclose = () => {
    check(opened, { "websocket opened": (value) => value === true });
  };
}
