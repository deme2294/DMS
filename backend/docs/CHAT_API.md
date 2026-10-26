# DMS API Documentation: Chat & Real-Time Messaging Module

> **Base REST Route:** `http://localhost:5000/api/chat`  
> **Socket.IO Server:** `http://localhost:5000` (WebSocket / Polling)  
> **Status:** IMPLEMENTED AND TESTED (Verified in Source Code & Live Runtime)

---

## 1. Architecture Overview

The DMS Chat Module combines **REST APIs** for persistent data management (room provisioning, message history, file uploads) with a high-performance **Socket.IO** server for live messaging, typing indicators, presence tracking, and ticket event broadcasts.

### Core Concepts
1. **Room Types:**
   * `ticket`: Associated with a specific ticket (`ticketId`). Automatically invites the ticket's tenant creator, assigned technician, and department manager.
   * `direct`: 1-on-1 private messaging between two users (`userId`).
   * `department`: Group channel for department members (`departmentId`).
2. **Persistence:** All messages are committed to the MySQL `chat_messages` table before or alongside Socket.IO broadcast, ensuring zero message loss if a client is temporarily offline.
3. **Attachments:** Uploaded through `POST /api/chat/upload` (max 10MB) into `uploads/chat/`. The returned file path is then included in the chat message payload.

---

## 2. REST Endpoints Summary

| Method | Endpoint | Auth Required | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/chat/rooms` | **Yes** | List all chat rooms caller participates in. |
| `GET` | `/api/chat/rooms/:roomId` | **Yes** | Get detailed chat room metadata. |
| `POST`| `/api/chat/rooms/ticket` | **Yes** | Find or auto-provision conversation room for a ticket. |
| `POST`| `/api/chat/rooms/direct` | **Yes** | Find or auto-provision 1-on-1 direct message room. |
| `POST`| `/api/chat/rooms/department` | **Yes** | Create department group chat room. |
| `GET` | `/api/chat/rooms/:roomId/participants` | **Yes** | List all participants in a room. |
| `POST`| `/api/chat/rooms/:roomId/participants` | **Yes** | Add participant to chat room. |
| `GET` | `/api/chat/rooms/:roomId/messages` | **Yes** | Get paginated room message history. |
| `POST`| `/api/chat/messages` | **Yes** | Send new message (REST fallback). |
| `PUT` | `/api/chat/messages/:messageId` | **Yes** | Edit message authored by caller. |
| `DELETE`| `/api/chat/messages/:messageId` | **Yes** | Soft-delete message authored by caller. |
| `POST`| `/api/chat/rooms/:roomId/read` | **Yes** | Mark messages in room as read. |
| `GET` | `/api/chat/unread` | **Yes** | Get total unread count across all user rooms. |
| `GET` | `/api/chat/search` | **Yes** | Search message history by query keyword. |
| `POST`| `/api/chat/upload` | **Yes** | Upload attachment for chat message. |
| `GET` | `/api/chat/online-users` | **Yes** | List currently connected users. |
| `GET` | `/api/chat/users` | **Yes** | List accessible contacts for messaging. |
| `GET` | `/api/chat/departments` | **Yes** | List accessible department rooms. |

---

## 3. REST Endpoint Specifications

### 3.1 Provision Ticket Chat Room (`POST /api/chat/rooms/ticket`)
Locates existing chat room for ticket or provisions a new one automatically.

* **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`.
* **Request Body:**
```json
{
  "ticketId": "b8db4630-f448-47e5-a040-270651bf553b"
}
```

#### Success Response (`HTTP 201 Created` or `200 OK`):
```json
{
  "success": true,
  "data": {
    "id": "97f4799c-c701-4bc4-954e-f58fd2fc5af4",
    "room_type": "ticket",
    "ticket_id": "b8db4630-f448-47e5-a040-270651bf553b",
    "department_id": "IT-01",
    "name": "Ticket: HD-2026-00014",
    "created_by": "ffffffff-ffff-ffff-ffff-ffffffffffff",
    "created_at": "2026-10-22T07:49:26.000Z",
    "creator_first_name": "John",
    "creator_last_name": "Tenant",
    "ticket_reference": "HD-2026-00014",
    "ticket_title": "Automated Verification Ticket",
    "online_members_count": 1,
    "total_members_count": 4,
    "unread_count": 0
  }
}
```

---

### 3.2 Send Message via REST (`POST /api/chat/messages`)
Stores message in database and triggers Socket.IO broadcast to room.

* **Request Body:**
```json
{
  "roomId": "97f4799c-c701-4bc4-954e-f58fd2fc5af4",
  "message": "Hello support, we rebooted the server as requested.",
  "messageType": "text"
}
```

#### Success Response (`HTTP 201 Created`):
```json
{
  "success": true,
  "data": {
    "id": "a51819f6-3cba-4a54-be6c-0978e67ad7e6",
    "room_id": "97f4799c-c701-4bc4-954e-f58fd2fc5af4",
    "sender_id": "ffffffff-ffff-ffff-ffff-ffffffffffff",
    "message_type": "text",
    "message": "Hello support, we rebooted the server as requested.",
    "attachment_path": null,
    "attachment_name": null,
    "attachment_size": null,
    "is_edited": 0,
    "is_deleted": 0,
    "created_at": "2026-10-22T07:50:24.000Z",
    "first_name": "John",
    "last_name": "Tenant",
    "username": "tenant"
  }
}
```

---

### 3.3 Get Room Messages (`GET /api/chat/rooms/:roomId/messages`)
Fetches message history.

* **Path Parameter:** `roomId` (UUID).
* **Query Parameters:** `limit` (default: 50, max: 100), `offset` (default: 0).
* **Success Response (`HTTP 200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "id": "a51819f6-3cba-4a54-be6c-0978e67ad7e6",
      "room_id": "97f4799c-c701-4bc4-954e-f58fd2fc5af4",
      "sender_id": "ffffffff-ffff-ffff-ffff-ffffffffffff",
      "message": "Hello support, we rebooted the server as requested.",
      "created_at": "2026-10-22T07:50:24.000Z",
      "first_name": "John",
      "last_name": "Tenant"
    }
  ]
}
```

---

### 3.4 Upload Chat Attachment (`POST /api/chat/upload`)
Uploads a binary attachment for use in chat.

* **Content-Type:** `multipart/form-data`.
* **Field:** `file` (binary, max 10MB).
* **Success Response (`HTTP 200 OK`):**
```json
{
  "success": true,
  "fileUrl": "/uploads/chat/chat-1729600000000.png",
  "originalName": "screenshot.png",
  "mimeType": "image/png",
  "size": 409600
}
```

---

## 4. Real-Time Socket.IO Specification

### 4.1 Connection & Handshake Authentication
Connect to `http://localhost:5000` with the JWT token in `auth.token`:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'YOUR_JWT_ACCESS_TOKEN'
  },
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('Socket.IO connected, id:', socket.id);
});

socket.on('connect_error', (err) => {
  console.error('Socket Authentication Failed:', err.message);
});
```

---

### 4.2 Client Outgoing Events (Emits)

| Event Name | Payload Structure | Purpose |
| :--- | :--- | :--- |
| `join-room` | `{ "roomId": "uuid" }` | Subscribe to live messages in a chat room. |
| `leave-room` | `{ "roomId": "uuid" }` | Unsubscribe from room. |
| `join-ticket` | `{ "ticketId": "uuid" }` | Join ticket updates room (`ticket:<ticketId>`). |
| `leave-ticket`| `{ "ticketId": "uuid" }` | Leave ticket updates room. |
| `send-message`| `{ "roomId": "uuid", "message": "text", "messageType": "text" }` | Broadcast live message to room. |
| `edit-message`| `{ "messageId": "uuid", "message": "updated text" }` | Edit existing message. |
| `delete-message`| `{ "messageId": "uuid" }` | Delete message. |
| `typing-start`| `{ "roomId": "uuid" }` | Broadcast typing indicator to room. |
| `typing-stop` | `{ "roomId": "uuid" }` | Clear typing indicator. |
| `mark-read` | `{ "roomId": "uuid", "messageIds": ["uuid"] }` | Acknowledge message read receipt. |

---

### 4.3 Server Incoming Events (Broadcasts)

| Event Name | Received Payload | Trigger |
| :--- | :--- | :--- |
| `new-message` | `{ id, room_id, sender_id, message, message_type, created_at, first_name, last_name, username }` | New message sent in the subscribed room. |
| `message-edited` | `{ messageId, roomId, message, edited_at }` | Author edited a message. |
| `message-deleted`| `{ messageId, roomId }` | Author deleted a message. |
| `user-typing` | `{ roomId, userId, username }` | Participant started typing. |
| `user-stopped-typing` | `{ roomId, userId }` | Participant stopped typing. |
| `messages-read` | `{ roomId, userId, messageIds }` | Messages marked read by peer. |
| `user-online` | `{ userId }` | User established connection. |
| `user-offline` | `{ userId, lastSeen }` | User disconnected. |
| `ticket:status_changed` | `{ ticketId, status, updatedBy, updatedAt }` | Ticket status updated. |
