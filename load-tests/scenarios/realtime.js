import http from "k6/http";
import { check } from "k6";
import ws from "k6/ws";
import { BASE_URL, TEST_ORIGIN } from "../config/env.js";
import { profile } from "../helpers/profiles.js";
import { loginOnce } from "../helpers/session.js";

const p = profile(__ENV.K6_PROFILE);

export const options = {
  scenarios: {
    websocket: { executor: "constant-vus", vus: p.vus, duration: p.duration },
  },
  thresholds: {
    ws_connecting: ["p(95)<2000"],
  },
};

export function setup() {
  return { cookie: loginOnce() };
}

export default function (data) {
  const socketUrl = BASE_URL.replace(/^http/, "ws") + "/socket.io/?EIO=4&transport=websocket";

  const response = ws.connect(
    socketUrl,
    {
      headers: {
        Cookie: data.cookie,
        Origin: TEST_ORIGIN,
      },
      tags: { endpoint: "socket_connect" },
    },
    function (socket) {
      let opened = false;

      socket.on("open", () => {
        opened = true;
        socket.send("40");
        socket.setTimeout(() => socket.close(), 3000);
      });

      socket.on("message", (message) => {
        if (message === "2") socket.send("3");
      });

      socket.on("error", () => {
        opened = false;
      });

      socket.on("close", () => {
        check(opened, { "socket session opened": (value) => value === true });
      });
    },
  );

  check(response, { "socket handshake returns 101": (r) => r && r.status === 101 });
}
