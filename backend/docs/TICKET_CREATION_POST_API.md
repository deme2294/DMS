# DMS API Documentation: Ticket Creation (POST Only)

> **Module:** Ticket Management  
> **HTTP Method:** `POST`  
> **Endpoint:** `http://localhost:5000/api/tickets`  
> **Status:** IMPLEMENTED AND TESTED (Verified in Source Code & Live Runtime)

---

## 1. Overview & Business Rules

The ticket creation endpoint allows authorized users (primarily clients/tenants) to log support requests into DMS. When a ticket is created:
1. A unique database `id` (UUIDv4) is generated.
2. A human-friendly `referenceNumber` (e.g., `HD-2026-00014`) and public `trackNumber` (e.g., `TRK-MVJF57AC-SCSN`) are automatically computed and assigned.
3. The ticket's `tenant_id` is automatically extracted from the authenticated user's JWT token. **Clients cannot inject or spoof arbitrary tenant IDs.**
4. The ticket is matched against active SLA policies based on category and priority, automatically computing `responseDueDate` and `dueDate`.
5. An initial audit entry is written to `ticket_status_history` (`to_status: "open"`).
6. Uploaded binary files are validated for size (max 10MB each, up to 5 files) and stored in `uploads/tickets/`.

---

## 2. Authentication & Authorization

| Requirement | Value |
| :--- | :--- |
| **Header** | `Authorization: Bearer <jwt_access_token>` |
| **Required Permission** | `tickets.create` |
| **Authorized Roles** | `tenant` (Standard client organization account) |
| **Token Acquisition** | `POST http://localhost:5000/api/auth/login` |

---

## 3. Request Specification

* **Content-Type:** `multipart/form-data` (or `application/x-www-form-urlencoded` / `application/json` when no attachments are sent).

### Form Fields

| Field Name | Type | Required | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `title` | `string` | **Yes** | Min 3, max 200 chars. Trimmed. | Short summary of the reported problem. |
| `description` | `string` | **Yes** | Non-empty string. | Detailed explanation of the issue, steps to reproduce, or symptoms. |
| `category` | `string` | **Yes** | Non-empty string. | Name of an active category (e.g., `"Account Access"`, `"Infrastructure"`) OR a valid category UUID. |
| `priority` | `string` | No | One of: `low`, `medium`, `high`, `urgent`. Default: `medium`. | Problem urgency level used for SLA target calculation. |
| `departmentId`| `string` | No | Alphanumeric string or UUID (2-36 chars). | Optional destination department identifier. |
| `attachments` | `file[]` | No | Max 5 files. Max 10MB per file. Allowed: image, PDF, docs, text. | Diagnostic logs, error screenshots, or configuration files. |

---

## 4. Response Specifications

### A. Successful Response (`HTTP 201 Created`)
```json
{
  "success": true,
  "message": "Ticket created",
  "data": {
    "id": "b8db4630-f448-47e5-a040-270651bf553b",
    "ticketNum": 14,
    "referenceNumber": "HD-2026-00014",
    "trackNumber": "TRK-MVJF57AC-SCSN",
    "tenantId": "11111111-1111-1111-1111-111111111111",
    "tenantName": "City Housing Office",
    "tenantEmail": "tenant@example.com",
    "tenantPhone": "0986591922",
    "tenantContactPerson": "John Tenant",
    "createdBy": "ffffffff-ffff-ffff-ffff-ffffffffffff",
    "createdByName": "John Tenant",
    "createdByEmail": "tenant@example.com",
    "createdByPhone": "0986591922",
    "departmentId": null,
    "departmentName": null,
    "assignedTo": null,
    "assignedToName": null,
    "title": "VPN connection drops every 15 minutes",
    "description": "Every morning while connected to Cisco AnyConnect, the tunnel drops.",
    "priority": "medium",
    "category": "Account Access",
    "status": "open",
    "tenantConfirmationStatus": "not_required",
    "isEscalated": false,
    "slaPolicyId": "7443160d-8ce0-4823-b0ef-f9ee690bef58",
    "dueDate": "2026-10-22T12:49:16.000Z",
    "responseDueDate": "2026-10-22T14:49:16.000Z",
    "escalationDueDate": null,
    "isOverdue": false,
    "remainingMs": 7199142,
    "createdAt": "2026-10-22T07:49:16.000Z",
    "updatedAt": "2026-10-22T07:49:16.000Z",
    "attachments": [
      {
        "id": "att-001",
        "fileName": "vpn_error.log",
        "fileUrl": "/uploads/tickets/vpn_error-1729600000.log",
        "fileType": "text/plain",
        "fileSize": 1024
      }
    ],
    "statusHistory": [
      {
        "id": "831ebed2-19bf-4776-8ac7-aa4768dab013",
        "fromStatus": null,
        "toStatus": "open",
        "changedBy": "ffffffff-ffff-ffff-ffff-ffffffffffff",
        "changedByName": "John Tenant",
        "notes": "Ticket submitted",
        "role": "tenant",
        "createdAt": "2026-10-22T07:49:16.000Z"
      }
    ]
  }
}
```

### B. Validation Error (`HTTP 400 Bad Request`)
Returned when required fields are missing, title length is violated, or priority is invalid:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "type": "field",
      "value": "ab",
      "msg": "Invalid value",
      "path": "title",
      "location": "body"
    },
    {
      "type": "field",
      "msg": "Invalid priority",
      "path": "priority",
      "location": "body"
    }
  ]
}
```

### C. Authentication Error (`HTTP 401 Unauthorized`)
Returned when the `Authorization` header is omitted, malformed, or contains an expired token:
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### D. Permission Error (`HTTP 403 Forbidden`)
Returned if an authenticated user does not have `tickets.create` permission:
```json
{
  "success": false,
  "message": "Access denied"
}
```

---

## 5. Duplicate Ticket Prevention During Retries

External systems integrating with DMS should implement client-side deduplication to prevent accidental double-submission caused by transient network timeouts:
1. **Cache Tracking Numbers:** Before submitting a retry, store the client-generated idempotency key or correlation ID.
2. **Pre-flight Query:** If a network timeout occurs, query `GET /api/tickets?status=open&sortBy=created_at&sortOrder=DESC` to check if a ticket with the same title was created within the last 60 seconds by the tenant.

---

## 6. Code Examples for Integration

### cURL
```bash
curl -X POST "http://localhost:5000/api/tickets" \
  -H "Authorization: Bearer YOUR_TENANT_JWT_TOKEN" \
  -F "title=Production Database Query Latency Spike" \
  -F "description=Queries to orders table exceeding 3000ms threshold." \
  -F "category=Infrastructure" \
  -F "priority=high" \
  -F "attachments=@./query_log.txt;type=text/plain"
```

### JavaScript / Node.js
```javascript
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

async function submitTicket(token) {
  const form = new FormData();
  form.append('title', 'Production Database Query Latency Spike');
  form.append('description', 'Queries to orders table exceeding 3000ms threshold.');
  form.append('category', 'Infrastructure');
  form.append('priority', 'high');
  form.append('attachments', fs.createReadStream('./query_log.txt'));

  const response = await fetch('http://localhost:5000/api/tickets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...form.getHeaders()
    },
    body: form
  });

  const result = await response.json();
  if (response.status === 201) {
    console.log('Ticket Created Successfully:', result.data.trackNumber);
    return result.data;
  } else {
    console.error('Ticket Creation Failed:', result);
  }
}
```

### Python
```python
import requests

url = "http://localhost:5000/api/tickets"
headers = {"Authorization": "Bearer YOUR_TENANT_JWT_TOKEN"}

data = {
    "title": "Production Database Query Latency Spike",
    "description": "Queries to orders table exceeding 3000ms threshold.",
    "category": "Infrastructure",
    "priority": "high"
}

files = {
    "attachments": ("query_log.txt", open("./query_log.txt", "rb"), "text/plain")
}

response = requests.post(url, headers=headers, data=data, files=files)
print(response.status_code, response.json())
```
