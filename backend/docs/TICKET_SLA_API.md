# DMS API Documentation: Ticket SLA Management Module

> **Base Route:** `http://localhost:5000/api/sla`  
> **Status:** IMPLEMENTED AND TESTED (Verified in Source Code & Live Runtime)

---

## 1. Overview & SLA Calculation Mechanics

The SLA (Service Level Agreement) module manages time-to-respond, time-to-resolve, and automatic escalation targets across ticket priorities and categories.

### Key Capabilities
* **Dynamic SLA Preview:** Publicly queryable endpoint (`/api/sla/preview`) that allows frontend forms and external systems to forecast deadlines before ticket submission.
* **Effective Policy Resolution:**
  1. DMS first checks if a specific SLA policy exists for the exact `categoryId` + `priority`.
  2. If none is found, it falls back to a global SLA policy for that `priority`.
  3. If no policy exists at all, it applies system defaults: 4 hours first response, 24 hours resolution.
* **Background Worker:** A background service (`services/slaMonitorService.js`) runs every **60 seconds**, flagging warnings when tickets reach 80% of deadline, marking breaches, and triggering auto-escalation. External clients do not need to trigger escalations manually.

---

## 2. Endpoints Summary

| Method | Endpoint | Auth Required | Authorized Roles | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/sla/preview` | **Optional** | Public / All | Preview SLA target deadlines for given priority & category. |
| `GET` | `/api/sla` | **Optional** | Public / All | List active SLA policies (or include inactive for Admin). |
| `GET` | `/api/sla/:id` | **Required** | Any Authenticated | Get full SLA policy configuration by ID. |
| `POST`| `/api/sla` | **Required** | `admin`, `ceo` | Create new SLA policy. |
| `PUT` | `/api/sla/:id` | **Required** | `admin`, `ceo` | Update SLA policy parameters or status. |
| `DELETE`| `/api/sla/:id` | **Required** | `admin`, `ceo` | Delete an SLA policy. |
| `POST`| `/api/sla/:id/test-compute`| **Required** | Any Authenticated | Test compute target deadlines for arbitrary creation timestamp. |

---

## 3. Endpoint Specifications

### 3.1 Preview SLA Deadlines (`GET /api/sla/preview`)
Calculates projected response, resolution, and escalation deadlines based on category and priority.

* **Query Parameters:**
  * `priority` (**Required**): `low`, `medium`, `high`, or `urgent`.
  * `categoryId` (*optional*): Target category UUID or omit for global.
  * `createdAt` (*optional*): ISO8601 timestamp (defaults to current server time).
* **Headers:** None required.

#### Success Response (`HTTP 200 OK`):
```json
{
  "success": true,
  "data": {
    "policyId": "sla00002-0000-0000-0000-000000000002",
    "policyName": "High SLA",
    "priority": "high",
    "category": "Global",
    "categoryId": null,
    "responseHours": 2,
    "resolutionHours": 8,
    "escalationHours": 0,
    "responseDueDate": "2026-10-22T12:48:55.681Z",
    "resolutionDueDate": "2026-10-22T18:48:55.681Z",
    "escalationDueDate": null
  }
}
```

---

### 3.2 List SLA Policies (`GET /api/sla`)
Lists configured SLA policies.

* **Query Parameters:**
  * `categoryId` (*optional*): Filter by category.
  * `includeInactive` (*optional*): `true` to include inactive policies (Admin/Manager/CEO only).

#### Success Response (`HTTP 200 OK`):
```json
{
  "success": true,
  "data": [
    {
      "id": "sla00001-0000-0000-0000-000000000001",
      "name": "Standard SLA",
      "priority": "medium",
      "categoryId": null,
      "responseHours": 4,
      "resolutionHours": 24,
      "escalationHours": 12,
      "workingHours": null,
      "isActive": true,
      "createdAt": "2026-10-13T08:04:37.000Z",
      "updatedAt": "2026-10-20T08:29:36.000Z"
    }
  ]
}
```

---

### 3.3 Create SLA Policy (`POST /api/sla`)
Creates a new SLA policy. Admin and CEO only.

* **Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`.
* **Validation Rules:**
  1. `resolutionHours` must be strictly greater than `responseHours`.
  2. `escalationHours` (if provided and > 0) must be greater than `responseHours` and less than or equal to `resolutionHours`.

#### Request Body:
```json
{
  "name": "Urgent Production SLA",
  "priority": "urgent",
  "categoryId": "cat00004-0000-0000-0000-000000000004",
  "responseHours": 1,
  "resolutionHours": 4,
  "escalationHours": 2,
  "description": "Strict 4-hour resolution window for critical production outages"
}
```

#### Success Response (`HTTP 201 Created`):
```json
{
  "success": true,
  "message": "SLA policy created",
  "data": {
    "id": "sla-prod-urgent-01",
    "name": "Urgent Production SLA",
    "priority": "urgent",
    "categoryId": "cat00004-0000-0000-0000-000000000004",
    "responseHours": 1,
    "resolutionHours": 4,
    "escalationHours": 2,
    "isActive": true
  }
}
```

#### Validation Error (`HTTP 400 Bad Request`):
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "Resolution Time (1h) must be strictly greater than First Response Time (2h)",
      "path": "resolutionHours"
    }
  ]
}
```

---

### 3.4 Update SLA Policy (`PUT /api/sla/:id`)
Modifies existing SLA policy parameters.

* **Request Body:**
```json
{
  "responseHours": 2,
  "resolutionHours": 6,
  "isActive": true
}
```
* **Success Response (`HTTP 200 OK`):**
```json
{
  "success": true,
  "message": "SLA policy updated",
  "data": {
    "id": "sla-prod-urgent-01",
    "responseHours": 2,
    "resolutionHours": 6,
    "isActive": true
  }
}
```

---

### 3.5 Test Compute Deadlines (`POST /api/sla/:id/test-compute`)
Simulates target computation for a policy given an arbitrary creation time.

* **Request Body:**
```json
{
  "createdAt": "2026-11-01T08:00:00.000Z"
}
```
* **Success Response (`HTTP 200 OK`):**
```json
{
  "success": true,
  "data": {
    "policy": { ... },
    "createdAt": "2026-11-01T08:00:00.000Z",
    "responseDueDate": "2026-11-01T10:00:00.000Z",
    "resolutionDueDate": "2026-11-01T14:00:00.000Z",
    "escalationDueDate": "2026-11-01T12:00:00.000Z"
  }
}
```

---

### 3.6 Delete SLA Policy (`DELETE /api/sla/:id`)
Removes an SLA policy. Admin and CEO only.

* **Success Response (`HTTP 200 OK`):**
```json
{
  "success": true,
  "message": "SLA policy deleted"
}
```
