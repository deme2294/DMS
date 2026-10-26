# DMS API Documentation: Ticket Categories Module

> **Base Route:** `http://localhost:5000/api/ticket-categories`  
> **Status:** IMPLEMENTED AND TESTED (Verified in Source Code & Live Runtime)

---

## 1. Overview & Category Architecture

The Ticket Categories module controls how support tickets are classified, routed, and associated with Service Level Agreements (SLAs).

### Key Features
* **Public & Authenticated Read Access:** Active categories can be queried publicly or with optional authentication to populate ticket submission forms.
* **Routing Types:**
  * `general`: Tickets can be assigned to any department manually or through general support.
  * `direct`: Requires a specific `departmentId`. Tickets created with this category are automatically routed to that department.
* **Dual Approval Workflow:**
  * When an **Admin** or **CEO** creates a category, it is immediately approved and activated.
  * When a **Manager** creates a category, it enters a `pending` request queue (`/api/ticket-categories/requests`), requiring review and approval by an Admin or CEO.
* **SLA Association:** Each category can link to a specific `slaPolicyId` to enforce custom response and resolution deadlines.

---

## 2. Endpoints Summary

| Method | Endpoint | Auth Required | Authorized Roles | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/ticket-categories` | **Optional** | Public / All | List active categories (used by ticket forms). |
| `GET` | `/api/ticket-categories/:id` | **Optional** | Public / All | Get detailed category record by ID. |
| `GET` | `/api/ticket-categories/requests`| **Required** | `admin`, `ceo` | List pending manager category proposals. |
| `POST`| `/api/ticket-categories` | **Required** | `admin`, `manager`, `ceo` | Create or request new category. |
| `PUT` | `/api/ticket-categories/:id` | **Required** | `admin`, `manager`, `ceo` | Update category details and routing. |
| `POST`| `/api/ticket-categories/:id/approve`| **Required** | `admin`, `ceo` | Approve a manager-submitted category. |
| `POST`| `/api/ticket-categories/:id/reject` | **Required** | `admin`, `ceo` | Reject a manager-submitted category. |
| `DELETE`| `/api/ticket-categories/:id`| **Required** | `admin`, `ceo` | Permanently delete category. |

---

## 3. Endpoint Specifications

### 3.1 List Categories (`GET /api/ticket-categories`)
Returns list of active ticket categories.

* **Query Parameters:**
  * `status` (*optional*): `active` (default), `inactive`, or `all` (only allowed for `admin`/`manager`/`ceo`).
  * `departmentId` (*optional*): Filter categories bound to a specific department.
* **Headers:** `Authorization: Bearer <token>` (*optional*).

#### Success Response (`HTTP 200 OK`):
```json
{
  "success": true,
  "data": [
    {
      "id": "cat00004-0000-0000-0000-000000000004",
      "name": "Account Access",
      "description": "Login and account access problems",
      "status": "approved",
      "isActive": true,
      "departmentId": null,
      "departmentName": null,
      "routingType": "general",
      "slaPolicyId": "7443160d-8ce0-4823-b0ef-f9ee690bef58",
      "slaPolicyName": "urgent",
      "slaPriority": "medium",
      "slaResponseHours": 4,
      "slaResolutionHours": 2,
      "slaEscalationHours": 0,
      "createdByName": "System Admin",
      "createdAt": "2026-10-13T08:04:37.000Z",
      "updatedAt": "2026-10-20T08:29:36.000Z"
    }
  ]
}
```

---

### 3.2 Get Category by ID (`GET /api/ticket-categories/:id`)
Returns a single category record.

* **Path Parameter:** `id` (string, max 64 chars).
* **Success Response (`HTTP 200 OK`):**
```json
{
  "success": true,
  "data": {
    "id": "cat00004-0000-0000-0000-000000000004",
    "name": "Account Access",
    "description": "Login and account access problems",
    "isActive": true,
    "routingType": "general",
    "slaPolicyId": "7443160d-8ce0-4823-b0ef-f9ee690bef58"
  }
}
```
* **Error Response (`HTTP 404 Not Found`):**
```json
{
  "success": false,
  "message": "Category not found"
}
```

---

### 3.3 Create Category (`POST /api/ticket-categories`)
Creates a new category (Admin/CEO) or requests category creation (Manager).

* **Headers:** `Authorization: Bearer <admin_or_manager_token>`, `Content-Type: application/json`.
* **Request Body:**
```json
{
  "name": "Network Infrastructure",
  "description": "Switches, routers, and VPN connectivity",
  "routingType": "direct",
  "departmentId": "IT-01",
  "slaPolicyId": "sla00002-0000-0000-0000-000000000002"
}
```

| Field | Type | Required | Notes |
| :--- | :--- | :--- | :--- |
| `name` | `string` | **Yes** | 2-100 characters. Unique name. |
| `description` | `string` | No | Purpose of category. |
| `routingType` | `string` | No | `general` or `direct` (default: `general`). |
| `departmentId` | `string` | Conditional | **Required** if `routingType === "direct"`. |
| `slaPolicyId` | `string` | No | UUID of default SLA policy. |

#### Success Response (`HTTP 201 Created`):
```json
{
  "success": true,
  "message": "Category created",
  "data": {
    "id": "cat-net-01",
    "name": "Network Infrastructure",
    "description": "Switches, routers, and VPN connectivity",
    "routingType": "direct",
    "departmentId": "IT-01",
    "isActive": true,
    "status": "approved"
  }
}
```

---

### 3.4 Update Category (`PUT /api/ticket-categories/:id`)
Modifies category fields or toggles active status.

* **Headers:** `Authorization: Bearer <admin_or_manager_token>`, `Content-Type: application/json`.
* **Path Parameter:** `id` (category ID).
* **Request Body:**
```json
{
  "name": "Network & Cloud Infrastructure",
  "isActive": true,
  "routingType": "general"
}
```
* **Success Response (`HTTP 200 OK`):**
```json
{
  "success": true,
  "message": "Category updated",
  "data": {
    "id": "cat-net-01",
    "name": "Network & Cloud Infrastructure",
    "isActive": true,
    "routingType": "general"
  }
}
```

---

### 3.5 Approve / Reject Category Proposal (`POST /:id/approve`, `POST /:id/reject`)
Admin or CEO reviews manager-submitted category proposals.

* **Request Body:**
```json
{
  "reviewNotes": "Approved for Q4 network migration rollout"
}
```
* **Success Response (`HTTP 200 OK`):**
```json
{
  "success": true,
  "message": "Category approved",
  "data": {
    "id": "cat-proposal-123",
    "status": "approved",
    "isActive": true,
    "reviewNotes": "Approved for Q4 network migration rollout"
  }
}
```

---

### 3.6 Delete Category (`DELETE /api/ticket-categories/:id`)
Permanently removes category. Admin or CEO only.

* **Success Response (`HTTP 200 OK`):**
```json
{
  "success": true,
  "message": "Category deleted"
}
```

---

## 4. Usage in Ticket Creation Validation

When calling `POST /api/tickets`, the `category` field can be passed in two verified formats:
1. **By Name:** `"category": "Account Access"` (DMS looks up the category by exact name).
2. **By UUID:** `"category": "cat00004-0000-0000-0000-000000000004"`.

If an inactive category or non-existent category is provided, ticket creation falls back to default general routing or rejects with a validation error.
