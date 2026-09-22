# Phase 09 — Authenticated Realtime & Socket Correctness

## Implemented architecture

Socket.IO authentication is server-authoritative. Each handshake reads the existing HttpOnly `accessToken` cookie, verifies it with the existing `verifyAccessToken()` helper, and loads the public user record server-side. The authenticated user ID is stored in `socket.data.userId` and is the only identity used by the connection lifecycle.

The client does not send a user ID in the Socket.IO handshake. `withCredentials: true` remains enabled so the browser can send the existing authentication cookie.

## Connection lifecycle

Authenticated sockets join a server-managed `user:<userId>` room. A single user may have multiple active sockets, so presence is tracked in an in-memory `Map<string, Set<string>>` for the single backend instance.

Disconnecting one socket removes only that socket. The user is removed from the online-user set only after the final active socket disconnects. Presence is therefore ephemeral and is not persisted in PostgreSQL or MongoDB.

No client-controlled room join protocol was added.

## Message delivery

The existing REST-first flow remains authoritative:

1. Authenticate the REST request.
2. Derive the sender from `req.user`.
3. Persist the message.
4. Emit the persisted message to the authenticated receiver's server-managed user room.
5. Return the persisted message through REST to the sender.

The frontend already deduplicates persisted messages by `_id`, so REST and realtime paths can converge without client-generated message IDs.

## Authentication errors

Socket handshake failures use explicit error codes for missing, invalid, and expired access credentials. The frontend stops an authentication-rejected socket from entering the normal reconnect loop. For an expired access JWT, it reuses the existing REST authentication path so the existing Axios refresh flow can obtain a new access token before reconnecting the socket. If that refresh fails, the existing `auth:expired` lifecycle clears authentication state. Missing or otherwise invalid socket credentials also use that existing auth-expired lifecycle. Transient network disconnects do not clear authentication state.

## Session revocation limitation

The access token is a stateless JWT with a 15-minute lifetime, while refresh sessions are stored separately. Revoking a refresh session does not invalidate an already-issued access JWT. Phase 09 does not introduce a second revocation mechanism. A socket can therefore remain authenticated until its access JWT expires unless another existing authentication path changes the application state.

## Integration coverage

`Backend/SocketIO/server.test.ts` exercises the real Socket.IO server with Socket.IO clients and the PostgreSQL persistence paths. Coverage includes:

- missing, invalid, and expired access credentials;
- server-derived identity and resistance to client `userId` impersonation;
- multiple sockets for one user and final-disconnect presence semantics;
- re-authentication on a new socket connection;
- persisted REST-first message delivery to the receiver's server-managed user room.

The backend test command is `npm run test:socket`. It requires the backend PostgreSQL and Redis services already used by the existing integration tests.

## Deployment boundary

This implementation is intentionally single-instance. The in-memory socket registry and Socket.IO rooms are local to one backend process. Redis presence and a Socket.IO Redis adapter are deferred to Phase 10; no distributed realtime state is claimed here.
