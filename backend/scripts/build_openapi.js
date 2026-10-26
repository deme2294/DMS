import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetPath = path.resolve(__dirname, '..', 'docs', 'openapi.yaml');

const doc = {
  openapi: '3.0.3',
  info: {
    title: 'DMS Help Desk Management System - Developer & Integration API',
    version: '1.0.0',
    description: `# DMS Help Desk Management System - Comprehensive API Specification

Welcome to the official OpenAPI 3.0.3 specification for the **DMS (Help Desk Management System)** backend. This document provides complete coverage of all REST endpoints, request payloads, response envelopes, role permissions, and WebSocket integration details.

---

### 🚀 Postman Quick-Start Guide

1. **Importing into Postman:**
   - In Postman, click **Import** (top left).
   - Select or drag-and-drop this \`openapi.yaml\` file.
   - Postman will automatically create a new Collection titled **"DMS Help Desk Management System - Developer & Integration API"** containing all endpoints organized by domain folders.

2. **Server & Variables Setup:**
   - The default base URL is configured to \`http://localhost:5005\` (or your staging/production URL).
   - In Postman Collection Variables, ensure \`baseUrl\` is set to \`http://localhost:5005\`.

3. **Automatic Bearer Token Capture:**
   - Open the request: **02. Authentication & Identity -> Authenticate User Credentials (POST /api/auth/login)**.
   - Go to the **Scripts / Tests** tab and paste the following snippet:
     \`\`\`javascript
     const response = pm.response.json();
     if (response.success && response.token) {
         pm.collectionVariables.set("bearerToken", response.token);
         console.log("✅ DMS JWT Bearer Token captured:", response.token.substring(0, 16) + "...");
     }
     \`\`\`
   - Set the collection **Authorization** type to **Bearer Token** with Token: \`{{bearerToken}}\`.
   - Now, all authenticated requests in the collection automatically inherit and use your JWT!

4. **Default Developer Test Accounts (Seed/Standard):**
   - **System Admin:** \`admin\` (or \`admin@demo.gov\`) / \`password\` (Full access across all modules)
   - **CEO Executive:** \`ceo\` (or \`ceo@demo.gov\`) / \`password\` (Executive dashboards, analytics, ticket merge)
   - **Department Manager:** \`manager\` (or \`manager@demo.gov\`) / \`password\` (Department queue, staff assignment, approval)
   - **Technical Staff:** \`staff\` (or \`staff@demo.gov\`) / \`password\` (Ticket execution, internal notes, resolution)
   - **Tenant / Customer:** \`tenant\` (or \`misgenaht@gmail.com\`) / \`password\` (Ticket submission, public KB, resolution sign-off)

---

### 🛡️ Authentication & Authorization Model
- **Mechanism:** JWT Bearer token passed in the \`Authorization\` header:
  \`\`\`http
  Authorization: Bearer <jwt_access_token>
  \`\`\`
- **Refresh Token:** Supported via HTTP-only \`refreshToken\` cookie via \`POST /api/auth/refresh\`.
- **Role Hierarchy:** \`admin\` > \`ceo\` > \`manager\` > \`staff\` > \`tenant\`.
- **Tenant Isolation:** For \`tenant\` users, queries are strictly scoped to the tenant's organization id extracted from the signed JWT.

---

### ⚡ Real-Time Socket.IO Events Reference
The backend exposes a Socket.IO server at \`ws://localhost:5005\` (path: \`/socket.io\`).
- **Authentication:** Pass \`auth: { token: "<jwt_access_token>" }\` or query param \`token\` during handshake.
- **Client to Server Events:**
  - \`join-room\`: \`{ roomId }\` (Join chat conversation room)
  - \`leave-room\`: \`{ roomId }\` (Leave chat conversation room)
  - \`send-message\`: \`{ roomId, message, messageType, attachmentId }\`
  - \`typing\`: \`{ roomId, isTyping: true/false }\`
  - \`mark-read\`: \`{ roomId, messageIds: [...] }\`
- **Server to Client Broadcasts:**
  - \`new-message\`: Full message object broadcasted to room participants.
  - \`user-typing\`: \`{ userId, username, isTyping, roomId }\`
  - \`message-read\`: \`{ roomId, userId, messageIds }\`
  - \`user-status-changed\`: \`{ userId, status: "online" | "offline" }\`
  - \`ticket-updated\`: Real-time notification when status, assignment, or priority changes.
  - \`new-notice\`: Broadcast when new targeted or public notice is published.

---

### 📁 File Uploads & Limits
- **Max File Size:** 10MB per file.
- **Allowed Formats:** JPG, JPEG, PNG, PDF, DOC, DOCX, XLS, XLSX, ZIP, TXT, LOG.
- **Static Retrieval URL:** \`GET {baseUrl}/uploads/{subfolder}/{filename}\` with \`Cross-Origin-Resource-Policy: cross-origin\`.
`,
    contact: {
      name: 'DMS API Integration Team',
      email: 'api-support@example.com',
      url: 'https://dms-helpdesk.example.com/support'
    },
    license: {
      name: 'Proprietary'
    }
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Local Development Server (Current Port 5000)'
    },
    {
      url: 'http://localhost:5005',
      description: 'Local Development Server (Default Port 5005)'
    },
    {
      url: 'https://dms-api.example.com',
      description: 'Staging / Production Environment'
    }
  ],
  tags: [
    { name: '01. System & Health', description: 'Operational heartbeat, uptime, database pool status and diagnostics' },
    { name: '02. Authentication & Identity', description: 'JWT issuance, session validation, profile & theme preferences' },
    { name: '03. User Management', description: 'User provisioning, directory lookups, role assignments, activation and password resets' },
    { name: '04. Department Management', description: 'Department hierarchies, heads of department, and member staffing' },
    { name: '05. Assignment Matrix', description: 'User-to-Department routing matrix grid, assignments, and quick toggles' },
    { name: '06. Tickets - Core Lifecycle', description: 'Ticket creation, query filtering, single lookups, and audit timelines' },
    { name: '07. Tickets - Workflow & Status', description: 'State machine transitions, completion verification, approvals, and reopenings' },
    { name: '08. Tickets - Assignment & Routing', description: 'Department routing, staff dispatch, overrides, and duplicate merge' },
    { name: '09. Tickets - Discussions & Notes', description: 'Public replies, scoped participant threads, and private technician notes' },
    { name: '10. Tickets - Attachments', description: 'Multipart diagnostic file uploads and file attachments' },
    { name: '11. Tickets - Notifications', description: 'In-app ticket notification polling, read status tracking, and deletions' },
    { name: '12. Ticket Categories & Routing', description: 'Service catalog categories, routing rules, and manager request review queue' },
    { name: '13. Service Level Agreements (SLA)', description: 'SLA policy definitions, deadline simulation, and operational targets' },
    { name: '14. Tenant Management & Registration', description: 'Tenant self-registration, organizational profile management, and approval queue' },
    { name: '15. Notices & Announcements', description: 'Broadcast notices, targeted departmental bulletins, expiry scheduling, and acknowledgements' },
    { name: '16. Knowledge Base Articles', description: 'Multi-stage KB authoring, revisions, versions, approval workflow, and public articles' },
    { name: '17. Chat, Presence & Video Meetings', description: 'Chat rooms, real-time messaging, attachments, online status, and video meeting invites' },
    { name: '18. Dashboards & Analytics', description: 'Role-tailored dashboards for Admin, CEO Executive, Manager, Staff, and Tenant' },
    { name: '19. Reports & Exports', description: 'Operational metrics and Excel/CSV report data exports' },
    { name: '20. Feedback & Surveys', description: 'Tenant satisfaction ratings, feedback submissions, and administrative responses' },
    { name: '21. Audit Logs & Compliance', description: 'Security audit trail logging, action filter queries, and compliance exports' },
    { name: '22. Direct Email & Communications', description: 'Direct email dispatch handler for ad-hoc communications' },
    { name: '23. Static Uploads', description: 'Public static retrieval for ticket, user profile, chat, and knowledge files' }
  ],
  paths: {},
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide JWT token obtained from POST /api/auth/login. Format: `Bearer <jwt_token>`.'
      }
    },
    schemas: {}
  }
};

// Helper builders
const jsonContent = (schema, example) => ({
  'application/json': {
    schema,
    ...(example ? { example } : {})
  }
});

const multipartContent = (schema) => ({
  'multipart/form-data': {
    schema
  }
});

const standardResponses = (successStatus, successDesc, successSchema, successExample) => {
  const resp = {
    [String(successStatus)]: {
      description: successDesc,
      ...(successSchema ? { content: jsonContent(successSchema, successExample) } : {})
    },
    '400': {
      description: 'Bad Request / Validation Failure',
      content: jsonContent({ $ref: '#/components/schemas/ValidationErrorResponse' })
    },
    '401': {
      description: 'Unauthorized / Missing or Expired JWT Token',
      content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
    },
    '403': {
      description: 'Forbidden / Caller lacks required role or permission',
      content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
    },
    '500': {
      description: 'Internal Server Error',
      content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
    }
  };
  return resp;
};

// ==========================================
// SCHEMAS DEFINITION
// ==========================================
doc.components.schemas = {
  SuccessResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string', example: 'Operation completed successfully' }
    }
  },
  ErrorResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      message: { type: 'string', example: 'An error occurred processing the request' }
    }
  },
  ValidationErrorResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      message: { type: 'string', example: 'Validation failed' },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string', example: 'title' },
            message: { type: 'string', example: 'Title is required' }
          }
        }
      }
    }
  },
  PaginationMeta: {
    type: 'object',
    properties: {
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 10 },
      total: { type: 'integer', example: 45 },
      pages: { type: 'integer', example: 5 }
    }
  },
  ServiceInfoResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      service: { type: 'string', example: 'DMS Helpdesk API Service' },
      message: { type: 'string', example: 'DMS Helpdesk API Service is running and operational' },
      version: { type: 'string', example: '1.0.0' },
      environment: { type: 'string', example: 'development' },
      status: { type: 'string', example: 'operational' },
      uptime: { type: 'string', example: '320s' },
      connections: {
        type: 'object',
        properties: {
          database: { type: 'string', example: 'healthy' },
          activeSockets: { type: 'integer', example: 3 }
        }
      },
      healthCheck: { type: 'string', example: '/api/health' },
      endpoints: { type: 'object' },
      timestamp: { type: 'string', format: 'date-time' }
    }
  },
  HealthResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      status: { type: 'string', example: 'operational' },
      message: { type: 'string', example: 'DMS Helpdesk API Service is running' },
      connections: {
        type: 'object',
        properties: {
          database: { type: 'string', example: 'healthy' },
          activeSockets: { type: 'integer', example: 3 }
        }
      },
      uptime: { type: 'string', example: '320s' },
      env: { type: 'string', example: 'development' },
      timestamp: { type: 'string', format: 'date-time' }
    }
  },
  LoginRequest: {
    type: 'object',
    required: ['identifier', 'password'],
    properties: {
      identifier: { type: 'string', example: 'admin', description: 'Username or registered email address (e.g., admin or admin@demo.gov)' },
      password: { type: 'string', format: 'password', example: 'password', description: 'Account password (default seed is password)' }
    }
  },
  LoginResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
      user: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'c1f7a840-a108-4e89-9a67-27b233a7e0f2' },
          username: { type: 'string', example: 'admin' },
          email: { type: 'string', example: 'admin@example.com' },
          firstName: { type: 'string', example: 'System' },
          lastName: { type: 'string', example: 'Administrator' },
          role: { type: 'string', enum: ['admin', 'manager', 'staff', 'tenant', 'ceo'], example: 'admin' },
          tenantId: { type: 'string', format: 'uuid', nullable: true, example: null },
          status: { type: 'string', example: 'active' },
          departments: { type: 'array', items: { type: 'string' }, example: ['dept-it-01'] }
        }
      }
    }
  },
  CurrentUserResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      user: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'c1f7a840-a108-4e89-9a67-27b233a7e0f2' },
          username: { type: 'string', example: 'admin' },
          email: { type: 'string', example: 'admin@example.com' },
          firstName: { type: 'string', example: 'System' },
          lastName: { type: 'string', example: 'Administrator' },
          role: { type: 'string', example: 'admin' },
          tenantId: { type: 'string', nullable: true, example: null },
          themePreference: { type: 'string', example: 'system' }
        }
      },
      permissions: {
        type: 'array',
        items: { type: 'string' },
        example: ['tickets.read', 'tickets.create', 'tickets.assign', 'tickets.complete', 'admin.all']
      }
    }
  },
  User: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', example: 'a9b8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d' },
      username: { type: 'string', example: 'john_technician' },
      email: { type: 'string', example: 'john.tech@example.com' },
      firstName: { type: 'string', example: 'John' },
      lastName: { type: 'string', example: 'Doe' },
      roleId: { type: 'integer', example: 3 },
      roleName: { type: 'string', example: 'staff' },
      status: { type: 'string', enum: ['active', 'inactive', 'locked'], example: 'active' },
      departmentId: { type: 'string', nullable: true, example: 'dept-network-01' },
      departmentName: { type: 'string', nullable: true, example: 'Network Infrastructure' },
      profileImage: { type: 'string', nullable: true, example: '/uploads/users/profile-123.jpg' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    }
  },
  Department: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'dept-infra-01' },
      name: { type: 'string', example: 'Infrastructure & DevOps' },
      code: { type: 'string', example: 'INFRA' },
      description: { type: 'string', example: 'Manages server clusters, cloud gateways, and networking' },
      headUserId: { type: 'string', format: 'uuid', nullable: true, example: 'b1a2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' },
      headName: { type: 'string', nullable: true, example: 'Sarah Connor' },
      status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
      memberCount: { type: 'integer', example: 8 },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  MatrixAssignment: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 14 },
      userId: { type: 'string', format: 'uuid', example: 'a9b8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d' },
      userName: { type: 'string', example: 'John Doe' },
      userEmail: { type: 'string', example: 'john.tech@example.com' },
      userRole: { type: 'string', example: 'staff' },
      departmentId: { type: 'string', example: 'dept-infra-01' },
      departmentName: { type: 'string', example: 'Infrastructure & DevOps' },
      assignedAt: { type: 'string', format: 'date-time' }
    }
  },
  Ticket: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', example: 'c1f7a840-a108-4e89-9a67-27b233a7e0f2' },
      trackNumber: { type: 'string', example: 'TICK-20261022-4821' },
      title: { type: 'string', example: 'Core API Gateway 502 Outage' },
      description: { type: 'string', example: 'Requests to /v1/payments returning HTTP 502 intermittently during peak morning hours.' },
      status: {
        type: 'string',
        enum: ['open', 'assigned', 'in_progress', 'pending', 'waiting_tenant', 'waiting_vendor', 'resolved', 'reopened', 'closed', 'completed', 'under_review', 'pending_approval'],
        example: 'open'
      },
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], example: 'high' },
      tenantId: { type: 'string', format: 'uuid', example: '5ab1c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' },
      tenantName: { type: 'string', example: 'Acme Enterprise Ltd' },
      departmentId: { type: 'string', nullable: true, example: 'dept-infra-01' },
      departmentName: { type: 'string', nullable: true, example: 'Infrastructure & DevOps' },
      assignedTo: { type: 'string', format: 'uuid', nullable: true, example: 'a9b8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d' },
      assignedStaffName: { type: 'string', nullable: true, example: 'John Doe' },
      categoryId: { type: 'string', nullable: true, example: 'cat-infra-01' },
      categoryName: { type: 'string', example: 'Infrastructure' },
      slaStatus: { type: 'string', enum: ['normal', 'warning', 'breached'], example: 'normal' },
      isEscalated: { type: 'boolean', example: false },
      firstResponseDeadline: { type: 'string', format: 'date-time', nullable: true },
      resolutionDeadline: { type: 'string', format: 'date-time', nullable: true },
      firstResponseAt: { type: 'string', format: 'date-time', nullable: true },
      resolvedAt: { type: 'string', format: 'date-time', nullable: true },
      closedAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      attachments: {
        type: 'array',
        items: { $ref: '#/components/schemas/TicketAttachment' }
      }
    }
  },
  TicketAttachment: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', example: 'e8174920-bc29-4d29-a031-104928174092' },
      ticketId: { type: 'string', format: 'uuid', example: 'c1f7a840-a108-4e89-9a67-27b233a7e0f2' },
      fileName: { type: 'string', example: 'gateway_logs.log' },
      fileUrl: { type: 'string', example: '/uploads/tickets/gateway_logs-1729600000000.log' },
      fileType: { type: 'string', example: 'text/plain' },
      fileSize: { type: 'integer', example: 1042 },
      uploadedAt: { type: 'string', format: 'date-time' }
    }
  },
  TicketTimelineEvent: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'ev-10293' },
      action: { type: 'string', example: 'STATUS_CHANGE' },
      fromStatus: { type: 'string', example: 'open' },
      toStatus: { type: 'string', example: 'in_progress' },
      notes: { type: 'string', example: 'Technician accepted ticket and started diagnosis' },
      performedBy: { type: 'string', example: 'John Doe' },
      performedById: { type: 'string', format: 'uuid', example: 'a9b8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  TicketReply: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', example: 'r1e2w3q4-5b6c-7d8e-9f0a-1b2c3d4e5f6a' },
      ticketId: { type: 'string', format: 'uuid', example: 'c1f7a840-a108-4e89-9a67-27b233a7e0f2' },
      userId: { type: 'string', format: 'uuid', example: 'a9b8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d' },
      userName: { type: 'string', example: 'John Doe' },
      userRole: { type: 'string', example: 'staff' },
      message: { type: 'string', example: 'We have identified a connection pool exhaustion on edge router #2. Restarting node now.' },
      visibility: { type: 'string', enum: ['all', 'internal', 'tenant', 'department', 'both', 'admin'], example: 'all' },
      attachmentUrl: { type: 'string', nullable: true, example: null },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  TicketNotification: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', example: 'n1o2t3i4-5f6g-7h8i-9j0k-1l2m3n4o5p6q' },
      userId: { type: 'string', format: 'uuid', example: 'c1f7a840-a108-4e89-9a67-27b233a7e0f2' },
      ticketId: { type: 'string', format: 'uuid', example: 'c1f7a840-a108-4e89-9a67-27b233a7e0f2' },
      type: { type: 'string', example: 'TICKET_ASSIGNED' },
      title: { type: 'string', example: 'New Ticket Assignment' },
      message: { type: 'string', example: 'Ticket TICK-20261022-4821 has been assigned to you.' },
      isRead: { type: 'boolean', example: false },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  Category: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'cat-infra-01' },
      name: { type: 'string', example: 'Infrastructure' },
      description: { type: 'string', example: 'Servers, cloud network, firewalls, and database clusters' },
      departmentId: { type: 'string', nullable: true, example: 'dept-infra-01' },
      departmentName: { type: 'string', nullable: true, example: 'Infrastructure & DevOps' },
      slaPolicyId: { type: 'string', nullable: true, example: 'sla-high-01' },
      routingType: { type: 'string', enum: ['general', 'direct'], example: 'direct' },
      isActive: { type: 'boolean', example: true },
      status: { type: 'string', enum: ['approved', 'pending', 'rejected'], example: 'approved' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  SLAPolicy: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'sla-urgent-01' },
      name: { type: 'string', example: 'Critical Outage SLA' },
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], example: 'urgent' },
      categoryId: { type: 'string', nullable: true, example: 'cat-infra-01' },
      responseHours: { type: 'integer', example: 1, description: 'First response target in hours' },
      resolutionHours: { type: 'integer', example: 4, description: 'Full resolution target in hours' },
      escalationHours: { type: 'integer', example: 2, description: 'Automatic escalation target in hours' },
      workingHours: {
        type: 'object',
        example: { timezone: 'UTC', start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] }
      },
      description: { type: 'string', example: 'Applied to urgent severity infrastructure incidents' },
      isActive: { type: 'boolean', example: true }
    }
  },
  SLAPreviewResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      preview: {
        type: 'object',
        properties: {
          priority: { type: 'string', example: 'high' },
          responseHours: { type: 'integer', example: 2 },
          resolutionHours: { type: 'integer', example: 8 },
          escalationHours: { type: 'integer', example: 4 },
          targetResponseDate: { type: 'string', format: 'date-time' },
          targetResolutionDate: { type: 'string', format: 'date-time' },
          targetEscalationDate: { type: 'string', format: 'date-time' }
        }
      }
    }
  },
  Tenant: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', example: '5ab1c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' },
      organizationName: { type: 'string', example: 'Acme Enterprise Solutions' },
      registrationNumber: { type: 'string', example: 'REG-987654-XYZ' },
      contactPerson: { type: 'string', example: 'Alice Johnson' },
      email: { type: 'string', example: 'alice@acme.com' },
      phone: { type: 'string', example: '+1-555-0199' },
      address: { type: 'string', example: '100 Innovation Boulevard, Tech City' },
      notes: { type: 'string', example: 'Tier-1 enterprise tenant' },
      status: { type: 'string', enum: ['active', 'inactive', 'pending'], example: 'active' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  Notice: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 42 },
      title: { type: 'string', example: 'Scheduled Core Gateway Maintenance' },
      description: { type: 'string', example: 'System will undergo planned maintenance on Sunday 02:00-04:00 UTC.' },
      category: { type: 'string', example: 'Maintenance' },
      priority: { type: 'string', enum: ['low', 'medium', 'high'], example: 'high' },
      status: { type: 'string', enum: ['draft', 'published', 'archived'], example: 'published' },
      targetAudience: { type: 'string', enum: ['all', 'admin', 'manager', 'staff', 'tenant', 'department'], example: 'all' },
      departmentId: { type: 'string', nullable: true, example: null },
      assignedTo: { type: 'string', format: 'uuid', nullable: true, example: null },
      expiresAt: { type: 'string', format: 'date-time', nullable: true, example: '2026-11-01T00:00:00.000Z' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  NoticeReply: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 7 },
      noticeId: { type: 'integer', example: 42 },
      userId: { type: 'string', format: 'uuid', example: 'a9b8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d' },
      userName: { type: 'string', example: 'John Doe' },
      message: { type: 'string', example: 'Backup routing tested and verified for the maintenance window.' },
      visibility: { type: 'string', enum: ['all', 'internal'], example: 'all' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  KnowledgeArticle: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'kb-auth-502-troubleshoot' },
      reference: { type: 'string', example: 'KB-2026-0042' },
      title: { type: 'string', example: 'How to Resolve Gateway 502 Bad Gateway Errors' },
      content: { type: 'string', example: 'Step 1: Check upstream microservice status. Step 2: Validate nginx upstream health.' },
      category: { type: 'string', example: 'Troubleshooting' },
      status: { type: 'string', enum: ['draft', 'pending', 'needs_revision', 'approved', 'published', 'archived'], example: 'published' },
      authorId: { type: 'string', format: 'uuid', example: 'a9b8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d' },
      authorName: { type: 'string', example: 'John Doe' },
      views: { type: 'integer', example: 124 },
      helpfulCount: { type: 'integer', example: 38 },
      unhelpfulCount: { type: 'integer', example: 2 },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    }
  },
  KnowledgeCategory: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'kb-cat-network' },
      name: { type: 'string', example: 'Networking & Connectivity' },
      description: { type: 'string', example: 'Guides on DNS, VPN, Firewalls, and IP routes' },
      articleCount: { type: 'integer', example: 12 }
    }
  },
  KnowledgeVersion: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'kb-ver-102' },
      articleId: { type: 'string', example: 'kb-auth-502-troubleshoot' },
      versionNumber: { type: 'integer', example: 2 },
      title: { type: 'string', example: 'How to Resolve Gateway 502 Bad Gateway Errors (Updated for v2.0)' },
      content: { type: 'string', example: 'Updated with Kubernetes ingress troubleshooting procedures.' },
      createdBy: { type: 'string', format: 'uuid' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  ChatRoom: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', example: '8f9e0d1c-2b3a-4c5d-6e7f-8a9b0c1d2e3f' },
      name: { type: 'string', example: 'Ticket TICK-20261022-4821 Discussion' },
      roomType: { type: 'string', enum: ['ticket', 'department', 'direct'], example: 'ticket' },
      ticketId: { type: 'string', format: 'uuid', nullable: true, example: 'c1f7a840-a108-4e89-9a67-27b233a7e0f2' },
      departmentId: { type: 'string', nullable: true, example: null },
      lastMessage: { type: 'string', example: 'Hotfix deployed to production cluster.' },
      lastMessageAt: { type: 'string', format: 'date-time' },
      unreadCount: { type: 'integer', example: 0 },
      participants: {
        type: 'array',
        items: { $ref: '#/components/schemas/ChatParticipant' }
      }
    }
  },
  ChatParticipant: {
    type: 'object',
    properties: {
      userId: { type: 'string', format: 'uuid', example: 'a9b8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d' },
      username: { type: 'string', example: 'john_technician' },
      firstName: { type: 'string', example: 'John' },
      lastName: { type: 'string', example: 'Doe' },
      role: { type: 'string', example: 'staff' },
      isOnline: { type: 'boolean', example: true }
    }
  },
  ChatMessage: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', example: 'm1n2b3v4-c5x6-7z8a-9s0d-1f2g3h4j5k6l' },
      roomId: { type: 'string', format: 'uuid', example: '8f9e0d1c-2b3a-4c5d-6e7f-8a9b0c1d2e3f' },
      senderId: { type: 'string', format: 'uuid', example: 'a9b8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d' },
      senderName: { type: 'string', example: 'John Doe' },
      senderRole: { type: 'string', example: 'staff' },
      message: { type: 'string', example: 'Can you provide the gateway trace ID from your error log?' },
      messageType: { type: 'string', enum: ['text', 'image', 'file'], example: 'text' },
      fileUrl: { type: 'string', nullable: true, example: null },
      isRead: { type: 'boolean', example: true },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  FeedbackItem: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'fb-201' },
      userId: { type: 'string', format: 'uuid', example: '5ab1c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' },
      userName: { type: 'string', example: 'Alice Johnson' },
      subject: { type: 'string', example: 'Excellent turnaround time on network outage' },
      message: { type: 'string', example: 'The support team was quick and provided clear explanations during the call.' },
      rating: { type: 'integer', minimum: 1, maximum: 5, example: 5 },
      status: { type: 'string', enum: ['pending', 'responded', 'closed'], example: 'responded' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  AuditLogEntry: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1045 },
      userId: { type: 'string', format: 'uuid', example: 'c1f7a840-a108-4e89-9a67-27b233a7e0f2' },
      userName: { type: 'string', example: 'admin' },
      userRole: { type: 'string', example: 'admin' },
      action: { type: 'string', example: 'TICKET_STATUS_CHANGED' },
      entityType: { type: 'string', example: 'ticket' },
      entityId: { type: 'string', example: 'c1f7a840-a108-4e89-9a67-27b233a7e0f2' },
      details: {
        type: 'object',
        example: { fromStatus: 'open', toStatus: 'in_progress', reason: 'Assigned to DevOps' }
      },
      ipAddress: { type: 'string', example: '127.0.0.1' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  }
};

// ==========================================
// PATHS DEFINITION (OVER 80 ENDPOINTS)
// ==========================================

console.log('Building endpoints for openapi.yaml...');

// 01. SYSTEM & HEALTH
doc.paths['/api'] = {
  get: {
    tags: ['01. System & Health'],
    operationId: 'getServiceInfo',
    summary: 'Root Service Status & Subsystem Health',
    description: 'Retrieves current API service name, version, operational status, database connectivity probe, and active Socket.IO client connections.',
    security: [],
    responses: {
      '200': {
        description: 'Service info and operational health',
        content: jsonContent({ $ref: '#/components/schemas/ServiceInfoResponse' })
      },
      '500': {
        description: 'Internal Server Error',
        content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
      }
    }
  }
};

doc.paths['/api/health'] = {
  get: {
    tags: ['01. System & Health'],
    operationId: 'getHealthProbe',
    summary: 'Service Liveness & Database Readiness Probe',
    description: 'Heartbeat probe for load balancers and container orchestration (Kubernetes/Docker). Verifies active MySQL connection.',
    security: [],
    responses: {
      '200': {
        description: 'System is healthy and accepting traffic',
        content: jsonContent({ $ref: '#/components/schemas/HealthResponse' })
      },
      '500': {
        description: 'Database unreachable / degraded status',
        content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' })
      }
    }
  }
};

// 02. AUTHENTICATION & IDENTITY
doc.paths['/api/auth/login'] = {
  post: {
    tags: ['02. Authentication & Identity'],
    operationId: 'loginUser',
    summary: 'Authenticate User Credentials (Get JWT)',
    description: `Authenticates a user by username or email and password.
Returns a signed JWT bearer token and sets an HTTP-only \`refreshToken\` cookie.
*Rate-limited to 20 attempts per 15 minutes.*

**Postman Tip:** Use the test script to automatically save \`response.token\` into collection variable \`{{bearerToken}}\`.`,
    security: [],
    requestBody: {
      required: true,
      content: jsonContent({ $ref: '#/components/schemas/LoginRequest' })
    },
    responses: standardResponses(200, 'Login successful', { $ref: '#/components/schemas/LoginResponse' })
  }
};

doc.paths['/api/auth/refresh'] = {
  post: {
    tags: ['02. Authentication & Identity'],
    operationId: 'refreshToken',
    summary: 'Refresh JWT Access Token',
    description: 'Issues a fresh access token using the HTTP-only \`refreshToken\` cookie.',
    security: [],
    responses: standardResponses(200, 'New access token issued', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
      }
    })
  }
};

doc.paths['/api/auth/me'] = {
  get: {
    tags: ['02. Authentication & Identity'],
    operationId: 'getCurrentUser',
    summary: 'Get Authenticated User Profile & Permissions',
    description: 'Validates bearer token and returns caller identity, role, department affiliations, tenant bindings, and assigned permission list.',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'Caller profile and permissions', { $ref: '#/components/schemas/CurrentUserResponse' })
  }
};

doc.paths['/api/auth/me/profile'] = {
  patch: {
    tags: ['02. Authentication & Identity'],
    operationId: 'updateMyProfile',
    summary: 'Update Current User Profile & Password',
    description: 'Allows authenticated user to update their name, phone, email, password, and upload a profile avatar.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      content: multipartContent({
        type: 'object',
        properties: {
          username: { type: 'string', example: 'john_doe_updated' },
          email: { type: 'string', format: 'email', example: 'john.updated@example.com' },
          firstName: { type: 'string', example: 'John' },
          lastName: { type: 'string', example: 'Doe' },
          phone: { type: 'string', example: '+1-555-0144' },
          currentPassword: { type: 'string', format: 'password' },
          newPassword: { type: 'string', format: 'password', minLength: 8 },
          confirmPassword: { type: 'string', format: 'password' },
          profileImage: { type: 'string', format: 'binary', description: 'Avatar image (JPEG, PNG)' }
        }
      })
    },
    responses: standardResponses(200, 'Profile updated successfully', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/auth/me/theme'] = {
  patch: {
    tags: ['02. Authentication & Identity'],
    operationId: 'updateMyTheme',
    summary: 'Update User Theme Preference',
    description: 'Sets system, light, or dark theme preference for the authenticated user.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['themePreference'],
        properties: {
          themePreference: { type: 'string', enum: ['system', 'light', 'dark'], example: 'dark' }
        }
      })
    },
    responses: standardResponses(200, 'Theme updated', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/auth/logout'] = {
  post: {
    tags: ['02. Authentication & Identity'],
    operationId: 'logoutUser',
    summary: 'Logout & Invalidate Session',
    description: 'Invalidates server session and clears authentication cookies.',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'Logged out successfully', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

// 03. USER MANAGEMENT
doc.paths['/api/users/roles'] = {
  get: {
    tags: ['03. User Management'],
    operationId: 'getUserRoles',
    summary: 'List Configured Roles',
    description: 'Returns all system roles and their assigned permission templates.',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'Role list retrieved', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        roles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 1 },
              name: { type: 'string', example: 'admin' },
              description: { type: 'string', example: 'System Administrator' }
            }
          }
        }
      }
    })
  }
};

doc.paths['/api/users'] = {
  get: {
    tags: ['03. User Management'],
    operationId: 'listUsers',
    summary: 'List & Search System Users',
    description: 'Lists users with role filtering, department filtering, and pagination. Requires `users.read` or `matrix.manage`.',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      { name: 'role', in: 'query', schema: { type: 'string', enum: ['admin', 'manager', 'staff', 'tenant'] } },
      { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive', 'locked'] } },
      { name: 'departmentId', in: 'query', schema: { type: 'string' }, example: 'dept-infra-01' }
    ],
    responses: standardResponses(200, 'Paginated users list', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: '#/components/schemas/User' } },
        pagination: { $ref: '#/components/schemas/PaginationMeta' }
      }
    })
  },
  post: {
    tags: ['03. User Management'],
    operationId: 'createUser',
    summary: 'Create / Provision User Account',
    description: 'Admin creates a new user with designated role, department, and profile image.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: multipartContent({
        type: 'object',
        required: ['username', 'email', 'password', 'firstName', 'lastName', 'roleId'],
        properties: {
          username: { type: 'string', example: 'new_staff_01' },
          email: { type: 'string', format: 'email', example: 'staff01@example.com' },
          password: { type: 'string', format: 'password', minLength: 8, example: 'SecureStaff@123' },
          firstName: { type: 'string', example: 'Michael' },
          lastName: { type: 'string', example: 'Scott' },
          roleId: { type: 'integer', example: 3, description: '1=admin, 2=manager, 3=staff, 4=tenant, 5=ceo' },
          status: { type: 'string', enum: ['active', 'inactive'], default: 'active' },
          profileImage: { type: 'string', format: 'binary' }
        }
      })
    },
    responses: standardResponses(201, 'User account created', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/users/{id}'] = {
  get: {
    tags: ['03. User Management'],
    operationId: 'getUserById',
    summary: 'Get User By ID',
    description: 'Fetches complete user record by UUID.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: 'a9b8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d' }],
    responses: standardResponses(200, 'User details retrieved', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        user: { $ref: '#/components/schemas/User' }
      }
    })
  },
  put: {
    tags: ['03. User Management'],
    operationId: 'updateUser',
    summary: 'Update User Details',
    description: 'Updates user metadata, names, email, role, or status.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: 'a9b8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d' }],
    requestBody: {
      content: multipartContent({
        type: 'object',
        properties: {
          username: { type: 'string', example: 'john_doe_modified' },
          email: { type: 'string', format: 'email', example: 'john.modified@example.com' },
          firstName: { type: 'string', example: 'Jonathan' },
          lastName: { type: 'string', example: 'Doe' },
          roleId: { type: 'integer', example: 2 },
          status: { type: 'string', enum: ['active', 'inactive', 'locked'] },
          profileImage: { type: 'string', format: 'binary' }
        }
      })
    },
    responses: standardResponses(200, 'User updated successfully', { $ref: '#/components/schemas/SuccessResponse' })
  },
  delete: {
    tags: ['03. User Management'],
    operationId: 'deleteUser',
    summary: 'Delete User Account',
    description: 'Deletes user record. Requires `users.delete` permission.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: 'a9b8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d' }],
    responses: standardResponses(200, 'User deleted', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/users/{id}/activate'] = {
  patch: {
    tags: ['03. User Management'],
    operationId: 'activateUser',
    summary: 'Activate User',
    description: 'Enables user login access.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: standardResponses(200, 'User activated', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/users/{id}/deactivate'] = {
  patch: {
    tags: ['03. User Management'],
    operationId: 'deactivateUser',
    summary: 'Deactivate User',
    description: 'Suspends user account and invalidates active sessions.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: standardResponses(200, 'User deactivated', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/users/{id}/reset-password'] = {
  patch: {
    tags: ['03. User Management'],
    operationId: 'resetUserPassword',
    summary: 'Admin Password Reset',
    description: 'Administratively resets password for a target user.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['newPassword'],
        properties: {
          newPassword: { type: 'string', format: 'password', minLength: 8, example: 'NewSecretPass@2026' }
        }
      })
    },
    responses: standardResponses(200, 'Password reset successfully', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/users/send-email'] = {
  post: {
    tags: ['03. User Management'],
    operationId: 'sendDirectUserEmail',
    summary: 'Send Direct Email from User Management',
    description: 'Sends an SMTP email message to a specified user or external recipient.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['to', 'subject', 'message'],
        properties: {
          to: { type: 'string', format: 'email', example: 'customer@client.com' },
          toName: { type: 'string', example: 'Valued Client' },
          subject: { type: 'string', example: 'Regarding your inquiry TICK-20261022-4821' },
          message: { type: 'string', example: 'We have updated your server configuration and require your verification.' }
        }
      })
    },
    responses: standardResponses(200, 'Email dispatched', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

// 04. DEPARTMENT MANAGEMENT
doc.paths['/api/departments/active'] = {
  get: {
    tags: ['04. Department Management'],
    operationId: 'getActiveDepartments',
    summary: 'Get Reference List of Active Departments',
    description: 'Public reference list of active departments for ticket routing dropdowns.',
    security: [],
    responses: standardResponses(200, 'Active departments list', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: '#/components/schemas/Department' } }
      }
    })
  }
};

doc.paths['/api/departments/heads'] = {
  get: {
    tags: ['04. Department Management'],
    operationId: 'getEligibleDepartmentHeads',
    summary: 'List Eligible Department Heads',
    description: 'Returns managers and senior staff eligible to be assigned as department heads.',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'Eligible heads list', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: '#/components/schemas/User' } }
      }
    })
  }
};

doc.paths['/api/departments'] = {
  get: {
    tags: ['04. Department Management'],
    operationId: 'listDepartments',
    summary: 'List All Departments',
    description: 'Paginated department management list. Requires `departments.manage`.',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive'] } }
    ],
    responses: standardResponses(200, 'Department listing', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: '#/components/schemas/Department' } },
        pagination: { $ref: '#/components/schemas/PaginationMeta' }
      }
    })
  },
  post: {
    tags: ['04. Department Management'],
    operationId: 'createDepartment',
    summary: 'Create New Department',
    description: 'Creates a department with unique code and assigns department head and members.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['name', 'code'],
        properties: {
          name: { type: 'string', example: 'Security Operations Center' },
          code: { type: 'string', example: 'SOC' },
          description: { type: 'string', example: 'Incident response, threat hunting, and compliance' },
          headUserId: { type: 'string', format: 'uuid', nullable: true },
          status: { type: 'string', enum: ['active', 'inactive'], default: 'active' },
          memberIds: { type: 'array', items: { type: 'string' } }
        }
      })
    },
    responses: standardResponses(201, 'Department created', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/departments/{id}'] = {
  get: {
    tags: ['04. Department Management'],
    operationId: 'getDepartmentById',
    summary: 'Get Department Details',
    description: 'Retrieves department details by identifier.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'dept-infra-01' }],
    responses: standardResponses(200, 'Department details', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        department: { $ref: '#/components/schemas/Department' }
      }
    })
  },
  put: {
    tags: ['04. Department Management'],
    operationId: 'updateDepartment',
    summary: 'Update Department Details',
    description: 'Updates department name, description, head user, status, or member list.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'dept-infra-01' }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Infrastructure & Cloud DevOps' },
          code: { type: 'string', example: 'INFRA' },
          description: { type: 'string', example: 'Expanded scope to cloud native infrastructure' },
          headUserId: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['active', 'inactive'] },
          memberIds: { type: 'array', items: { type: 'string' } }
        }
      })
    },
    responses: standardResponses(200, 'Department updated', { $ref: '#/components/schemas/SuccessResponse' })
  },
  delete: {
    tags: ['04. Department Management'],
    operationId: 'deleteDepartment',
    summary: 'Delete Department',
    description: 'Removes department record if no open tickets depend on it.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'dept-infra-01' }],
    responses: standardResponses(200, 'Department deleted', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/departments/{id}/members'] = {
  get: {
    tags: ['04. Department Management'],
    operationId: 'getDepartmentMembers',
    summary: 'List Department Members & Staff',
    description: 'Returns all technicians and managers mapped to the department.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'dept-infra-01' }],
    responses: standardResponses(200, 'Department members list', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: '#/components/schemas/User' } }
      }
    })
  },
  post: {
    tags: ['04. Department Management'],
    operationId: 'assignDepartmentMembers',
    summary: 'Batch Assign Users to Department',
    description: 'Updates the list of user IDs affiliated with this department.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'dept-infra-01' }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['userIds'],
        properties: {
          userIds: {
            type: 'array',
            items: { type: 'string' },
            example: ['a9b8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d', 'b1a2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d']
          }
        }
      })
    },
    responses: standardResponses(200, 'Members updated', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/departments/{id}/activate'] = {
  patch: {
    tags: ['04. Department Management'],
    operationId: 'activateDepartment',
    summary: 'Activate Department',
    description: 'Enables department for ticket routing.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    responses: standardResponses(200, 'Department activated', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/departments/{id}/deactivate'] = {
  patch: {
    tags: ['04. Department Management'],
    operationId: 'deactivateDepartment',
    summary: 'Deactivate Department',
    description: 'Disables department from new ticket routing.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    responses: standardResponses(200, 'Department deactivated', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

// 05. ASSIGNMENT MATRIX
doc.paths['/api/matrix/grid'] = {
  get: {
    tags: ['05. Assignment Matrix'],
    operationId: 'getMatrixGrid',
    summary: 'Get 2D Staff-to-Department Routing Grid',
    description: 'Returns the complete grid representation of technicians, departments, and active assignment checkboxes.',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'Matrix grid data', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        departments: { type: 'array', items: { $ref: '#/components/schemas/Department' } },
        users: { type: 'array', items: { $ref: '#/components/schemas/User' } },
        assignments: { type: 'array', items: { $ref: '#/components/schemas/MatrixAssignment' } }
      }
    })
  }
};

doc.paths['/api/matrix'] = {
  get: {
    tags: ['05. Assignment Matrix'],
    operationId: 'listMatrixAssignments',
    summary: 'List Individual Matrix Assignments',
    description: 'Queries user-to-department assignments with optional filtering by user or department.',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
      { name: 'userId', in: 'query', schema: { type: 'string', format: 'uuid' } },
      { name: 'departmentId', in: 'query', schema: { type: 'string' } }
    ],
    responses: standardResponses(200, 'Assignments list', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: '#/components/schemas/MatrixAssignment' } },
        pagination: { $ref: '#/components/schemas/PaginationMeta' }
      }
    })
  },
  post: {
    tags: ['05. Assignment Matrix'],
    operationId: 'createMatrixAssignment',
    summary: 'Assign User to Department',
    description: 'Creates a routing pairing between a staff member and a department.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['userId', 'departmentId'],
        properties: {
          userId: { type: 'string', format: 'uuid', example: 'a9b8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d' },
          departmentId: { type: 'string', example: 'dept-infra-01' }
        }
      })
    },
    responses: standardResponses(201, 'Assignment created', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/matrix/toggle'] = {
  patch: {
    tags: ['05. Assignment Matrix'],
    operationId: 'toggleMatrixAssignment',
    summary: 'Toggle User Department Membership',
    description: 'Quick toggle switch for the admin matrix UI.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['userId', 'departmentId', 'assigned'],
        properties: {
          userId: { type: 'string', format: 'uuid', example: 'a9b8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d' },
          departmentId: { type: 'string', example: 'dept-infra-01' },
          assigned: { type: 'boolean', example: true }
        }
      })
    },
    responses: standardResponses(200, 'Matrix toggled', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/matrix/pair/{userId}/{departmentId}'] = {
  delete: {
    tags: ['05. Assignment Matrix'],
    operationId: 'deleteMatrixPair',
    summary: 'Remove Assignment by User and Department ID',
    description: 'Deletes matrix assignment by pair tuple.',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      { name: 'departmentId', in: 'path', required: true, schema: { type: 'string' } }
    ],
    responses: standardResponses(200, 'Pair unassigned', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/matrix/{id}'] = {
  get: {
    tags: ['05. Assignment Matrix'],
    operationId: 'getMatrixById',
    summary: 'Get Assignment by ID',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
    responses: standardResponses(200, 'Assignment details', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        assignment: { $ref: '#/components/schemas/MatrixAssignment' }
      }
    })
  },
  delete: {
    tags: ['05. Assignment Matrix'],
    operationId: 'deleteMatrixAssignment',
    summary: 'Delete Assignment Record by ID',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
    responses: standardResponses(200, 'Assignment deleted', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

// 06. TICKETS - CORE LIFECYCLE
doc.paths['/api/tickets/track/{trackNumber}'] = {
  get: {
    tags: ['06. Tickets - Core Lifecycle'],
    operationId: 'trackTicketPublic',
    summary: 'Public Ticket Status Tracking (Anonymous)',
    description: 'Allows external customers or tenants to query ticket status by public tracking number without authenticating.',
    security: [],
    parameters: [{ name: 'trackNumber', in: 'path', required: true, schema: { type: 'string' }, example: 'TICK-20261022-4821' }],
    responses: standardResponses(200, 'Ticket found', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        ticket: { $ref: '#/components/schemas/Ticket' }
      }
    })
  }
};

doc.paths['/api/tickets/categories'] = {
  get: {
    tags: ['06. Tickets - Core Lifecycle'],
    operationId: 'getTicketCategoriesForForm',
    summary: 'Get Categories Available for Tickets',
    description: 'Returns categories that callers can select when creating tickets.',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'Category list', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        categories: { type: 'array', items: { $ref: '#/components/schemas/Category' } }
      }
    })
  }
};

doc.paths['/api/tickets'] = {
  get: {
    tags: ['06. Tickets - Core Lifecycle'],
    operationId: 'listTickets',
    summary: 'List & Filter Tickets',
    description: `Queries tickets with pagination and filtering.
- **Tenant:** Automatically scoped to caller's tenant organization.
- **Staff / Manager:** Scoped to departmental assignments.
- **Admin / CEO:** Global visibility.`,
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
      {
        name: 'status',
        in: 'query',
        schema: {
          type: 'string',
          enum: ['open', 'assigned', 'in_progress', 'pending', 'waiting_tenant', 'waiting_vendor', 'resolved', 'reopened', 'closed', 'completed']
        }
      },
      { name: 'priority', in: 'query', schema: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] } },
      { name: 'sortBy', in: 'query', schema: { type: 'string', default: 'created_at' } },
      { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'], default: 'DESC' } }
    ],
    responses: standardResponses(200, 'Ticket page retrieved', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: '#/components/schemas/Ticket' } },
        pagination: { $ref: '#/components/schemas/PaginationMeta' }
      }
    })
  },
  post: {
    tags: ['06. Tickets - Core Lifecycle'],
    operationId: 'createTicket',
    summary: 'Submit New Ticket (With Attachments)',
    description: 'Submits a new ticket. Supports up to 5 attachments (max 10MB each) via multipart form-data.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: multipartContent({
        type: 'object',
        required: ['title', 'description', 'category'],
        properties: {
          title: { type: 'string', example: 'API Gateway 502 Outage in Production' },
          description: { type: 'string', example: 'Payment service gateway returns 502 bad gateway intermittently for European users.' },
          category: { type: 'string', example: 'Infrastructure' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
          departmentId: { type: 'string', example: 'dept-infra-01' },
          attachments: {
            type: 'array',
            items: { type: 'string', format: 'binary' },
            description: 'Optional files (max 5)'
          }
        }
      })
    },
    responses: standardResponses(201, 'Ticket created', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        ticket: { $ref: '#/components/schemas/Ticket' }
      }
    })
  }
};

doc.paths['/api/tickets/{id}'] = {
  get: {
    tags: ['06. Tickets - Core Lifecycle'],
    operationId: 'getTicketById',
    summary: 'Get Ticket Details by ID',
    description: 'Returns full ticket entity, calculated SLA deadlines, status lights, and attached files.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: 'c1f7a840-a108-4e89-9a67-27b233a7e0f2' }],
    responses: standardResponses(200, 'Ticket found', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        ticket: { $ref: '#/components/schemas/Ticket' }
      }
    })
  },
  put: {
    tags: ['06. Tickets - Core Lifecycle'],
    operationId: 'updateTicket',
    summary: 'Update Ticket Metadata',
    description: 'Updates title, description, priority, category, or assigned technician.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: 'c1f7a840-a108-4e89-9a67-27b233a7e0f2' }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: {
          title: { type: 'string', example: 'Updated: API Gateway 502 Outage' },
          description: { type: 'string', example: 'Updated description with additional log headers.' },
          category: { type: 'string', example: 'Infrastructure' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          departmentId: { type: 'string', example: 'dept-infra-01' },
          assignedTo: { type: 'string', format: 'uuid', nullable: true }
        }
      })
    },
    responses: standardResponses(200, 'Ticket updated', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        ticket: { $ref: '#/components/schemas/Ticket' }
      }
    })
  },
  delete: {
    tags: ['06. Tickets - Core Lifecycle'],
    operationId: 'deleteTicket',
    summary: 'Delete Ticket Record',
    description: 'Permanently deletes ticket and associated timeline/notes. Admin role required.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: 'c1f7a840-a108-4e89-9a67-27b233a7e0f2' }],
    responses: standardResponses(200, 'Ticket deleted', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tickets/{id}/timeline'] = {
  get: {
    tags: ['06. Tickets - Core Lifecycle'],
    operationId: 'getTicketTimeline',
    summary: 'Get Ticket Audit Timeline History',
    description: 'Chronological timeline of status transitions, reassignments, internal notes, and SLA milestones.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: 'c1f7a840-a108-4e89-9a67-27b233a7e0f2' }],
    responses: standardResponses(200, 'Ticket timeline', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        timeline: { type: 'array', items: { $ref: '#/components/schemas/TicketTimelineEvent' } }
      }
    })
  }
};

// 07. TICKETS - WORKFLOW & STATUS
doc.paths['/api/tickets/{id}/status'] = {
  patch: {
    tags: ['07. Tickets - Workflow & Status'],
    operationId: 'changeTicketStatus',
    summary: 'Transition Ticket Status (State Machine)',
    description: 'Validates status transitions against the role workflow matrix.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: 'c1f7a840-a108-4e89-9a67-27b233a7e0f2' }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['open', 'assigned', 'in_progress', 'pending', 'waiting_tenant', 'waiting_vendor', 'resolved', 'reopened', 'closed', 'completed'],
            example: 'in_progress'
          },
          notes: { type: 'string', example: 'Investigation initiated on database cluster node #2.' },
          departmentId: { type: 'string' },
          assignedTo: { type: 'string', format: 'uuid' }
        }
      })
    },
    responses: standardResponses(200, 'Status updated', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        ticket: { $ref: '#/components/schemas/Ticket' }
      }
    })
  }
};

doc.paths['/api/tickets/{id}/complete'] = {
  post: {
    tags: ['07. Tickets - Workflow & Status'],
    operationId: 'markTicketComplete',
    summary: 'Mark Work Completed (Technician/Manager)',
    description: 'Staff or manager submits resolution notes and moves ticket to pending verification.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: {
          notes: { type: 'string', example: 'Memory leak patched, application pod pool recycled and verified operational.' }
        }
      })
    },
    responses: standardResponses(200, 'Ticket marked complete', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tickets/{id}/approve'] = {
  post: {
    tags: ['07. Tickets - Workflow & Status'],
    operationId: 'approveTicketCompletion',
    summary: 'Approve / Confirm Ticket Resolution',
    description: 'Tenant or Manager confirms that the issue has been resolved satisfactorily and optionally submits satisfaction rating and feedback.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: {
          notes: { type: 'string', example: 'Verified from customer side. Gateway functioning normally.' },
          rating: { type: 'integer', minimum: 1, maximum: 5, example: 5 },
          feedback: { type: 'string', example: 'Speedy resolution and great communication.' }
        }
      })
    },
    responses: standardResponses(200, 'Resolution approved', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tickets/{id}/reject-completion'] = {
  post: {
    tags: ['07. Tickets - Workflow & Status'],
    operationId: 'rejectTicketCompletion',
    summary: 'Reject Proposed Resolution',
    description: 'Rejects resolution and returns ticket to `in_progress` state for further work.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: {
          reason: { type: 'string', example: 'Still observing intermittent 502 responses on checkout endpoint.' },
          notes: { type: 'string', example: 'Please recheck load balancer session affinity.' }
        }
      })
    },
    responses: standardResponses(200, 'Resolution rejected and reopened to in_progress', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tickets/{id}/close'] = {
  post: {
    tags: ['07. Tickets - Workflow & Status'],
    operationId: 'closeTicket',
    summary: 'Formally Close Ticket',
    description: 'Closes ticket permanently.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: {
          notes: { type: 'string', example: 'Closing ticket as confirmed solved by client.' }
        }
      })
    },
    responses: standardResponses(200, 'Ticket closed', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tickets/{id}/reopen'] = {
  post: {
    tags: ['07. Tickets - Workflow & Status'],
    operationId: 'reopenTicket',
    summary: 'Reopen Ticket',
    description: 'Reopens a closed or resolved ticket within the permissible reopening window.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: {
          reason: { type: 'string', example: 'Issue reoccurred after 24 hours.' },
          notes: { type: 'string', example: 'Need investigation into cron job trigger.' }
        }
      })
    },
    responses: standardResponses(200, 'Ticket reopened', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

// 08. TICKETS - ASSIGNMENT & ROUTING
doc.paths['/api/tickets/departments/{departmentId}/managers'] = {
  get: {
    tags: ['08. Tickets - Assignment & Routing'],
    operationId: 'getDepartmentManagers',
    summary: 'Get Department Managers for Assignment',
    description: 'Retrieves managers eligible to receive departmental ticket assignments.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'departmentId', in: 'path', required: true, schema: { type: 'string' }, example: 'dept-infra-01' }],
    responses: standardResponses(200, 'Managers list', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: '#/components/schemas/User' } }
      }
    })
  }
};

doc.paths['/api/tickets/{id}/assign-department'] = {
  post: {
    tags: ['08. Tickets - Assignment & Routing'],
    operationId: 'assignTicketDepartment',
    summary: 'Admin Assigns Ticket to Department',
    description: 'Directs ticket to a specific department queue and optionally selects department manager.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['departmentId'],
        properties: {
          departmentId: { type: 'string', example: 'dept-infra-01' },
          managerId: { type: 'string', format: 'uuid', nullable: true },
          assignedTo: { type: 'string', format: 'uuid', nullable: true },
          notes: { type: 'string', example: 'Routing to Infrastructure team for gateway triage.' }
        }
      })
    },
    responses: standardResponses(200, 'Department assigned', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tickets/{id}/assign-staff'] = {
  post: {
    tags: ['08. Tickets - Assignment & Routing'],
    operationId: 'assignTicketStaff',
    summary: 'Assign Ticket to Staff Technician',
    description: 'Manager assigns ticket to technician in their department.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['staffId'],
        properties: {
          staffId: { type: 'string', format: 'uuid', example: 'a9b8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d' },
          notes: { type: 'string', example: 'Please inspect cloud edge logs immediately.' }
        }
      })
    },
    responses: standardResponses(200, 'Staff assigned', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tickets/{id}/reassign'] = {
  post: {
    tags: ['08. Tickets - Assignment & Routing'],
    operationId: 'reassignTicketStaff',
    summary: 'Reassign Ticket to Another Staff Technician',
    description: 'Transfers ticket assignment from current technician to a new technician.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['staffId'],
        properties: {
          staffId: { type: 'string', format: 'uuid', example: 'b1a2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' },
          notes: { type: 'string', example: 'Original technician called out; reassigning to Sarah.' }
        }
      })
    },
    responses: standardResponses(200, 'Ticket reassigned', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tickets/{id}/assignment'] = {
  patch: {
    tags: ['08. Tickets - Assignment & Routing'],
    operationId: 'overrideTicketAssignment',
    summary: 'Admin Override Assignment Attribution',
    description: 'Administrative override allowing admins to manually correct assignedTo and assignedBy references.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: {
          assignedTo: { type: 'string', format: 'uuid', nullable: true },
          assignedBy: { type: 'string', format: 'uuid', nullable: true },
          notes: { type: 'string', example: 'Corrected assignment audit tracking' }
        }
      })
    },
    responses: standardResponses(200, 'Assignment overridden', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tickets/{id}/accept'] = {
  post: {
    tags: ['08. Tickets - Assignment & Routing'],
    operationId: 'acceptTicketAssignment',
    summary: 'Accept Ticket Assignment',
    description: 'Technician formally accepts ownership of an assigned ticket.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: standardResponses(200, 'Assignment accepted', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tickets/{id}/reject'] = {
  post: {
    tags: ['08. Tickets - Assignment & Routing'],
    operationId: 'rejectTicketAssignment',
    summary: 'Reject Ticket Assignment',
    description: 'Technician rejects ticket assignment, returning it to the department manager queue.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: {
          reason: { type: 'string', example: 'Requires DB cluster specialist' }
        }
      })
    },
    responses: standardResponses(200, 'Assignment rejected', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tickets/{id}/escalate'] = {
  post: {
    tags: ['08. Tickets - Assignment & Routing'],
    operationId: 'escalateTicket',
    summary: 'Escalate Ticket Priority / SLA',
    description: 'Flags ticket as escalated, notifies managers and department head.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: {
          notes: { type: 'string', example: 'Customer production is blocked; SLA escalation required.' }
        }
      })
    },
    responses: standardResponses(200, 'Ticket escalated', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tickets/{id}/merge-candidates'] = {
  get: {
    tags: ['08. Tickets - Assignment & Routing'],
    operationId: 'getMergeCandidates',
    summary: 'Find Duplicate Ticket Merge Candidates',
    description: 'Admin or CEO scans for similar open tickets with matching keywords or category.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: standardResponses(200, 'Merge candidates found', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        candidates: { type: 'array', items: { $ref: '#/components/schemas/Ticket' } }
      }
    })
  }
};

doc.paths['/api/tickets/{id}/merge'] = {
  post: {
    tags: ['08. Tickets - Assignment & Routing'],
    operationId: 'mergeTickets',
    summary: 'Merge Duplicate Tickets',
    description: 'Merges secondary duplicate tickets into this primary ticket and closes source tickets with merge reference. Admin or CEO only.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['sourceIds'],
        properties: {
          sourceIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            example: ['d2e3f4a5-b6c7-8d9e-0f1a-2b3c4d5e6f7a']
          },
          notes: { type: 'string', example: 'Merging duplicate customer reports of the same gateway issue.' }
        }
      })
    },
    responses: standardResponses(200, 'Tickets merged successfully', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tickets/{id}/priority'] = {
  patch: {
    tags: ['08. Tickets - Assignment & Routing'],
    operationId: 'changeTicketPriority',
    summary: 'Change Ticket Priority',
    description: 'Updates priority (low, medium, high, urgent). Recalculates SLA targets.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['priority'],
        properties: {
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], example: 'urgent' }
        }
      })
    },
    responses: standardResponses(200, 'Priority updated', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tickets/{id}/category'] = {
  patch: {
    tags: ['08. Tickets - Assignment & Routing'],
    operationId: 'changeTicketCategory',
    summary: 'Change Ticket Category',
    description: 'Re-categorizes ticket and updates routing type.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['category'],
        properties: {
          category: { type: 'string', example: 'Security & Access' }
        }
      })
    },
    responses: standardResponses(200, 'Category updated', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

// 09. TICKETS - DISCUSSIONS & NOTES
doc.paths['/api/tickets/{id}/internal-note'] = {
  post: {
    tags: ['09. Tickets - Discussions & Notes'],
    operationId: 'addTicketInternalNote',
    summary: 'Add Private Internal Staff Note',
    description: 'Creates a private diagnostic note visible only to staff, managers, and administrators (hidden from tenant callers).',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', example: 'Internal: Checked logs. Redis cluster connection timeout at 08:31 UTC.' },
          departmentId: { type: 'string', example: 'dept-infra-01' }
        }
      })
    },
    responses: standardResponses(201, 'Internal note added', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tickets/{id}/replies'] = {
  get: {
    tags: ['09. Tickets - Discussions & Notes'],
    operationId: 'getTicketReplies',
    summary: 'Get Ticket Replies & Discussion History',
    description: 'Retrieves public and authorized private messages for a ticket thread.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: standardResponses(200, 'Replies retrieved', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        replies: { type: 'array', items: { $ref: '#/components/schemas/TicketReply' } }
      }
    })
  },
  post: {
    tags: ['09. Tickets - Discussions & Notes'],
    operationId: 'addTicketReply',
    summary: 'Post Public or Scoped Reply',
    description: 'Adds a message reply to the ticket discussion. Broadcasts real-time notification to participants.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', example: 'We have applied an updated configuration to your gateway. Please verify.' },
          visibility: { type: 'string', enum: ['all', 'internal', 'tenant', 'department', 'both', 'admin'], default: 'all' },
          attachmentId: { type: 'string', format: 'uuid', nullable: true },
          targetUserId: { type: 'string', format: 'uuid', nullable: true }
        }
      })
    },
    responses: standardResponses(201, 'Reply posted', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        reply: { $ref: '#/components/schemas/TicketReply' }
      }
    })
  }
};

// 10. TICKETS - ATTACHMENTS
doc.paths['/api/tickets/{id}/attachments'] = {
  post: {
    tags: ['10. Tickets - Attachments'],
    operationId: 'uploadTicketAttachments',
    summary: 'Upload Attachments to Ticket',
    description: 'Uploads up to 5 files to an existing ticket. Max 10MB per file.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      required: true,
      content: multipartContent({
        type: 'object',
        properties: {
          attachments: {
            type: 'array',
            items: { type: 'string', format: 'binary' }
          }
        }
      })
    },
    responses: standardResponses(201, 'Attachments uploaded', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        attachments: { type: 'array', items: { $ref: '#/components/schemas/TicketAttachment' } }
      }
    })
  }
};

// 11. TICKETS - NOTIFICATIONS
doc.paths['/api/tickets/notifications'] = {
  get: {
    tags: ['11. Tickets - Notifications'],
    operationId: 'getTicketNotifications',
    summary: 'Get Current User Notifications',
    description: 'Retrieves chronological list of ticket and workflow notifications.',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'Notifications list', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        notifications: { type: 'array', items: { $ref: '#/components/schemas/TicketNotification' } }
      }
    })
  }
};

doc.paths['/api/tickets/notifications/unread-count'] = {
  get: {
    tags: ['11. Tickets - Notifications'],
    operationId: 'getUnreadNotificationCount',
    summary: 'Get Unread Notification Count',
    description: 'Returns total count of unread notifications for badge polling.',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'Unread count', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        unreadCount: { type: 'integer', example: 4 }
      }
    })
  }
};

doc.paths['/api/tickets/notifications/{id}/read'] = {
  patch: {
    tags: ['11. Tickets - Notifications'],
    operationId: 'markNotificationRead',
    summary: 'Mark Notification as Read',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    responses: standardResponses(200, 'Notification marked read', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tickets/notifications/read-all'] = {
  patch: {
    tags: ['11. Tickets - Notifications'],
    operationId: 'markAllNotificationsRead',
    summary: 'Mark All Notifications Read',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'All notifications marked read', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tickets/notifications/{id}'] = {
  delete: {
    tags: ['11. Tickets - Notifications'],
    operationId: 'deleteNotification',
    summary: 'Delete Notification Item',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    responses: standardResponses(200, 'Notification deleted', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

// 12. TICKET CATEGORIES & ROUTING
doc.paths['/api/ticket-categories'] = {
  get: {
    tags: ['12. Ticket Categories & Routing'],
    operationId: 'listTicketCategories',
    summary: 'List Categories (Public & Filterable)',
    description: 'Returns active categories for ticket forms.',
    security: [],
    parameters: [{ name: 'departmentId', in: 'query', schema: { type: 'string' } }],
    responses: standardResponses(200, 'Categories retrieved', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: '#/components/schemas/Category' } }
      }
    })
  },
  post: {
    tags: ['12. Ticket Categories & Routing'],
    operationId: 'createTicketCategory',
    summary: 'Create Category',
    description: 'Admin or Manager creates a category. Direct routing requires a departmentId.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Cloud Infrastructure' },
          description: { type: 'string', example: 'Kubernetes, container registry, and load balancers' },
          departmentId: { type: 'string', example: 'dept-infra-01' },
          slaPolicyId: { type: 'string', example: 'sla-urgent-01' },
          routingType: { type: 'string', enum: ['general', 'direct'], default: 'general' }
        }
      })
    },
    responses: standardResponses(201, 'Category created', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/Category' }
      }
    })
  }
};

doc.paths['/api/ticket-categories/requests'] = {
  get: {
    tags: ['12. Ticket Categories & Routing'],
    operationId: 'listCategoryRequests',
    summary: 'List Manager Category Proposals (Admin Queue)',
    description: 'Approval queue where admins review category requests proposed by department managers.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'approved', 'rejected'] } }],
    responses: standardResponses(200, 'Category requests', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: '#/components/schemas/Category' } }
      }
    })
  }
};

doc.paths['/api/ticket-categories/{id}'] = {
  get: {
    tags: ['12. Ticket Categories & Routing'],
    operationId: 'getCategoryById',
    summary: 'Get Category by ID',
    security: [],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'cat-infra-01' }],
    responses: standardResponses(200, 'Category details', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/Category' }
      }
    })
  },
  put: {
    tags: ['12. Ticket Categories & Routing'],
    operationId: 'updateTicketCategory',
    summary: 'Update Category',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'cat-infra-01' }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Infrastructure & Cloud' },
          description: { type: 'string', example: 'Expanded scope' },
          departmentId: { type: 'string', nullable: true },
          slaPolicyId: { type: 'string', nullable: true },
          routingType: { type: 'string', enum: ['general', 'direct'] },
          isActive: { type: 'boolean' }
        }
      })
    },
    responses: standardResponses(200, 'Category updated', { $ref: '#/components/schemas/SuccessResponse' })
  },
  delete: {
    tags: ['12. Ticket Categories & Routing'],
    operationId: 'deleteTicketCategory',
    summary: 'Delete Category',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    responses: standardResponses(200, 'Category deleted', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/ticket-categories/{id}/approve'] = {
  post: {
    tags: ['12. Ticket Categories & Routing'],
    operationId: 'approveCategoryRequest',
    summary: 'Approve Proposed Category (Admin/CEO)',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: { reviewNotes: { type: 'string', example: 'Approved for production use' } }
      })
    },
    responses: standardResponses(200, 'Category approved', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/ticket-categories/{id}/reject'] = {
  post: {
    tags: ['12. Ticket Categories & Routing'],
    operationId: 'rejectCategoryRequest',
    summary: 'Reject Proposed Category (Admin/CEO)',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: { reviewNotes: { type: 'string', example: 'Please merge into existing Infrastructure category.' } }
      })
    },
    responses: standardResponses(200, 'Category rejected', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

// 13. SLA MANAGEMENT & DEADLINES
doc.paths['/api/sla/preview'] = {
  get: {
    tags: ['13. Service Level Agreements (SLA)'],
    operationId: 'previewSLA',
    summary: 'Preview SLA Target Deadlines',
    description: 'Calculates response, resolution, and escalation deadlines based on category, priority, and working calendar.',
    security: [],
    parameters: [
      { name: 'priority', in: 'query', required: true, schema: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] }, example: 'high' },
      { name: 'categoryId', in: 'query', schema: { type: 'string' }, example: 'cat-infra-01' },
      { name: 'createdAt', in: 'query', schema: { type: 'string', format: 'date-time' } }
    ],
    responses: standardResponses(200, 'SLA preview calculated', { $ref: '#/components/schemas/SLAPreviewResponse' })
  }
};

doc.paths['/api/sla'] = {
  get: {
    tags: ['13. Service Level Agreements (SLA)'],
    operationId: 'listSLAPolicies',
    summary: 'List All SLA Policies',
    security: [],
    parameters: [{ name: 'categoryId', in: 'query', schema: { type: 'string' } }],
    responses: standardResponses(200, 'Policies list', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: '#/components/schemas/SLAPolicy' } }
      }
    })
  },
  post: {
    tags: ['13. Service Level Agreements (SLA)'],
    operationId: 'createSLAPolicy',
    summary: 'Create SLA Policy',
    description: 'Admin/CEO creates an SLA policy enforcing `resolutionHours > responseHours`.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['name', 'priority', 'responseHours', 'resolutionHours'],
        properties: {
          name: { type: 'string', example: 'High Priority SLA' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], example: 'high' },
          categoryId: { type: 'string', nullable: true },
          responseHours: { type: 'integer', example: 2 },
          resolutionHours: { type: 'integer', example: 8 },
          escalationHours: { type: 'integer', example: 4 },
          workingHours: {
            type: 'object',
            example: { timezone: 'UTC', start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] }
          },
          description: { type: 'string', example: 'Standard high-priority business SLA' }
        }
      })
    },
    responses: standardResponses(201, 'SLA policy created', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/sla/{id}'] = {
  get: {
    tags: ['13. Service Level Agreements (SLA)'],
    operationId: 'getSLAPolicyById',
    summary: 'Get SLA Policy Details',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    responses: standardResponses(200, 'Policy details', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        policy: { $ref: '#/components/schemas/SLAPolicy' }
      }
    })
  },
  put: {
    tags: ['13. Service Level Agreements (SLA)'],
    operationId: 'updateSLAPolicy',
    summary: 'Update SLA Policy',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Updated SLA Policy' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          responseHours: { type: 'integer', example: 2 },
          resolutionHours: { type: 'integer', example: 8 },
          escalationHours: { type: 'integer', example: 4 },
          workingHours: { type: 'object' },
          description: { type: 'string' },
          isActive: { type: 'boolean' }
        }
      })
    },
    responses: standardResponses(200, 'SLA policy updated', { $ref: '#/components/schemas/SuccessResponse' })
  },
  delete: {
    tags: ['13. Service Level Agreements (SLA)'],
    operationId: 'deleteSLAPolicy',
    summary: 'Delete SLA Policy',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    responses: standardResponses(200, 'SLA policy deleted', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/sla/{id}/test-compute'] = {
  post: {
    tags: ['13. Service Level Agreements (SLA)'],
    operationId: 'testComputeSLA',
    summary: 'Test SLA Date Calculations',
    description: 'Simulates SLA timeline calculation from a test start timestamp.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: {
          createdAt: { type: 'string', format: 'date-time', example: '2026-10-23T08:00:00.000Z' }
        }
      })
    },
    responses: standardResponses(200, 'Computed SLA targets', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        targets: {
          type: 'object',
          properties: {
            responseTarget: { type: 'string', format: 'date-time' },
            resolutionTarget: { type: 'string', format: 'date-time' }
          }
        }
      }
    })
  }
};

// 14. TENANT MANAGEMENT & REGISTRATION
doc.paths['/api/tenants/register'] = {
  post: {
    tags: ['14. Tenant Management & Registration'],
    operationId: 'registerTenantPublic',
    summary: 'Public Tenant Self-Registration',
    description: 'External organization registers an account and primary administrative user.',
    security: [],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['organizationName', 'contactPerson', 'email', 'username', 'password', 'confirmPassword'],
        properties: {
          organizationName: { type: 'string', example: 'Acme Enterprise Ltd' },
          contactPerson: { type: 'string', example: 'Alice Johnson' },
          email: { type: 'string', format: 'email', example: 'alice@acme.com' },
          username: { type: 'string', example: 'acme_admin' },
          password: { type: 'string', format: 'password', minLength: 8, example: 'TenantPassword@123' },
          confirmPassword: { type: 'string', format: 'password', minLength: 8, example: 'TenantPassword@123' },
          phone: { type: 'string', example: '+1-555-0199' },
          address: { type: 'string', example: '100 Innovation Blvd' },
          registrationNumber: { type: 'string', example: 'CORP-88291' }
        }
      })
    },
    responses: standardResponses(201, 'Tenant registration submitted', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tenants/profile/me'] = {
  get: {
    tags: ['14. Tenant Management & Registration'],
    operationId: 'getMyTenantProfile',
    summary: 'Get Authenticated Tenant Profile',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'Tenant profile', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        tenant: { $ref: '#/components/schemas/Tenant' }
      }
    })
  },
  put: {
    tags: ['14. Tenant Management & Registration'],
    operationId: 'updateMyTenantProfile',
    summary: 'Update Authenticated Tenant Profile',
    security: [{ BearerAuth: [] }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: {
          contactPerson: { type: 'string', example: 'Alice Smith' },
          phone: { type: 'string', example: '+1-555-0198' },
          address: { type: 'string', example: 'Suite 200, Innovation Blvd' },
          notes: { type: 'string' }
        }
      })
    },
    responses: standardResponses(200, 'Tenant profile updated', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tenants'] = {
  get: {
    tags: ['14. Tenant Management & Registration'],
    operationId: 'listTenants',
    summary: 'List All Registered Tenants',
    description: 'Admin lists all tenant organizations and registration statuses.',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive', 'pending'] } }
    ],
    responses: standardResponses(200, 'Tenants list', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: '#/components/schemas/Tenant' } },
        pagination: { $ref: '#/components/schemas/PaginationMeta' }
      }
    })
  },
  post: {
    tags: ['14. Tenant Management & Registration'],
    operationId: 'createTenantAdmin',
    summary: 'Admin Creates Tenant Organization',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['organizationName', 'registrationNumber', 'contactPerson', 'email', 'phone', 'username', 'password', 'confirmPassword'],
        properties: {
          organizationName: { type: 'string', example: 'Globex Corp' },
          registrationNumber: { type: 'string', example: 'REG-55214' },
          contactPerson: { type: 'string', example: 'Hank Scorpio' },
          email: { type: 'string', format: 'email', example: 'hank@globex.com' },
          phone: { type: 'string', example: '+1-555-0177' },
          address: { type: 'string' },
          username: { type: 'string', example: 'globex_admin' },
          password: { type: 'string', format: 'password', minLength: 8, example: 'GlobexPass@123' },
          confirmPassword: { type: 'string', format: 'password', minLength: 8, example: 'GlobexPass@123' },
          status: { type: 'string', enum: ['active', 'inactive', 'pending'], default: 'active' }
        }
      })
    },
    responses: standardResponses(201, 'Tenant created', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tenants/{id}'] = {
  get: {
    tags: ['14. Tenant Management & Registration'],
    operationId: 'getTenantById',
    summary: 'Get Tenant by ID',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: standardResponses(200, 'Tenant details', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        tenant: { $ref: '#/components/schemas/Tenant' }
      }
    })
  },
  put: {
    tags: ['14. Tenant Management & Registration'],
    operationId: 'updateTenantAdmin',
    summary: 'Update Tenant by ID',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: {
          organizationName: { type: 'string' },
          contactPerson: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          address: { type: 'string' },
          registrationNumber: { type: 'string' },
          status: { type: 'string', enum: ['active', 'inactive', 'pending'] }
        }
      })
    },
    responses: standardResponses(200, 'Tenant updated', { $ref: '#/components/schemas/SuccessResponse' })
  },
  delete: {
    tags: ['14. Tenant Management & Registration'],
    operationId: 'deleteTenant',
    summary: 'Delete Tenant',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: standardResponses(200, 'Tenant deleted', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tenants/{id}/activate'] = {
  patch: {
    tags: ['14. Tenant Management & Registration'],
    operationId: 'activateTenant',
    summary: 'Activate Tenant',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: standardResponses(200, 'Tenant activated', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tenants/{id}/deactivate'] = {
  patch: {
    tags: ['14. Tenant Management & Registration'],
    operationId: 'deactivateTenant',
    summary: 'Deactivate Tenant',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: standardResponses(200, 'Tenant deactivated', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tenants/{id}/approve'] = {
  patch: {
    tags: ['14. Tenant Management & Registration'],
    operationId: 'approveTenant',
    summary: 'Approve Pending Tenant',
    description: 'Admin approves a self-registered tenant organization, activating their login access.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: standardResponses(200, 'Tenant approved', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/tenants/send-email'] = {
  post: {
    tags: ['14. Tenant Management & Registration'],
    operationId: 'sendTenantEmail',
    summary: 'Send Direct Email to Tenant',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['to', 'subject', 'message'],
        properties: {
          to: { type: 'string', format: 'email', example: 'tenant@example.com' },
          toName: { type: 'string', example: 'Customer Representative' },
          subject: { type: 'string', example: 'Important Account Update' },
          message: { type: 'string', example: 'Your tenant profile verification has been approved.' }
        }
      })
    },
    responses: standardResponses(200, 'Email dispatched', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

// 15. NOTICES & ANNOUNCEMENTS
doc.paths['/api/notices/public'] = {
  get: {
    tags: ['15. Notices & Announcements'],
    operationId: 'getPublicNotices',
    summary: 'Get Public Announcements',
    security: [],
    responses: standardResponses(200, 'Public notices retrieved', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        notices: { type: 'array', items: { $ref: '#/components/schemas/Notice' } }
      }
    })
  }
};

doc.paths['/api/notices/categories'] = {
  get: {
    tags: ['15. Notices & Announcements'],
    operationId: 'getNoticeCategories',
    summary: 'Get Notice Categories',
    security: [],
    responses: standardResponses(200, 'Notice categories retrieved', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        categories: { type: 'array', items: { type: 'string' } }
      }
    })
  }
};

doc.paths['/api/notices/my/inbox'] = {
  get: {
    tags: ['15. Notices & Announcements'],
    operationId: 'getMyNoticesInbox',
    summary: 'Get Notices Inbox for Current User',
    description: 'Retrieves notices filtered by caller role, department, and direct assignments.',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
    ],
    responses: standardResponses(200, 'Inbox notices', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        notices: { type: 'array', items: { $ref: '#/components/schemas/Notice' } }
      }
    })
  }
};

doc.paths['/api/notices/my/created'] = {
  get: {
    tags: ['15. Notices & Announcements'],
    operationId: 'getMyCreatedNotices',
    summary: 'Get Notices Created by Current User',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'User created notices', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        notices: { type: 'array', items: { $ref: '#/components/schemas/Notice' } }
      }
    })
  }
};

doc.paths['/api/notices/targeted'] = {
  post: {
    tags: ['15. Notices & Announcements'],
    operationId: 'createTargetedNotice',
    summary: 'Create Targeted Notice (Admin/Manager)',
    description: 'Creates a notice targeted to a specific audience, department, or user.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', example: 'Maintenance Window Tonight' },
          description: { type: 'string', example: 'Please ensure all active ticket syncs are paused by 23:00.' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' },
          targetAudience: { type: 'string', enum: ['all', 'admin', 'manager', 'staff', 'tenant', 'department'], default: 'department' },
          departmentId: { type: 'string', example: 'dept-infra-01' },
          assignedTo: { type: 'string', format: 'uuid', nullable: true }
        }
      })
    },
    responses: standardResponses(201, 'Targeted notice created', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/notices/{id}'] = {
  get: {
    tags: ['15. Notices & Announcements'],
    operationId: 'getNoticeById',
    summary: 'Get Notice by ID',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
    responses: standardResponses(200, 'Notice details', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        notice: { $ref: '#/components/schemas/Notice' }
      }
    })
  },
  put: {
    tags: ['15. Notices & Announcements'],
    operationId: 'updateNotice',
    summary: 'Update Notice',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          status: { type: 'string', enum: ['draft', 'published', 'archived'] }
        }
      })
    },
    responses: standardResponses(200, 'Notice updated', { $ref: '#/components/schemas/SuccessResponse' })
  },
  delete: {
    tags: ['15. Notices & Announcements'],
    operationId: 'deleteNotice',
    summary: 'Delete Notice',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
    responses: standardResponses(200, 'Notice deleted', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/notices/{id}/acknowledge'] = {
  post: {
    tags: ['15. Notices & Announcements'],
    operationId: 'acknowledgeNotice',
    summary: 'Acknowledge Receipt of Notice',
    description: 'Records that the caller has read and acknowledged the notice bulletin.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
    responses: standardResponses(200, 'Notice acknowledged', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/notices/{id}/replies'] = {
  get: {
    tags: ['15. Notices & Announcements'],
    operationId: 'getNoticeReplies',
    summary: 'Get Notice Discussion Replies',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
    responses: standardResponses(200, 'Notice replies retrieved', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        replies: { type: 'array', items: { $ref: '#/components/schemas/NoticeReply' } }
      }
    })
  },
  post: {
    tags: ['15. Notices & Announcements'],
    operationId: 'createNoticeReply',
    summary: 'Reply to Notice',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', example: 'Awaiting network team confirmation.' },
          visibility: { type: 'string', enum: ['all', 'internal'], default: 'all' }
        }
      })
    },
    responses: standardResponses(201, 'Reply posted', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

// 16. KNOWLEDGE BASE ARTICLES
doc.paths['/api/knowledge/public'] = {
  get: {
    tags: ['16. Knowledge Base Articles'],
    operationId: 'listPublicArticles',
    summary: 'List Public Knowledge Articles (Anonymous)',
    description: 'Returns published self-help articles for public visitors and customer portal search.',
    security: [],
    responses: standardResponses(200, 'Public articles list', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        articles: { type: 'array', items: { $ref: '#/components/schemas/KnowledgeArticle' } }
      }
    })
  }
};

doc.paths['/api/knowledge'] = {
  get: {
    tags: ['16. Knowledge Base Articles'],
    operationId: 'listKBArticles',
    summary: 'List & Search KB Articles',
    description: 'Searches articles with pagination, category filter, and role-scoped status visibility.',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      { name: 'search', in: 'query', schema: { type: 'string' } },
      { name: 'category', in: 'query', schema: { type: 'string' } },
      { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'pending', 'needs_revision', 'approved', 'published', 'archived'] } }
    ],
    responses: standardResponses(200, 'Articles list', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: '#/components/schemas/KnowledgeArticle' } },
        pagination: { $ref: '#/components/schemas/PaginationMeta' }
      }
    })
  },
  post: {
    tags: ['16. Knowledge Base Articles'],
    operationId: 'createKBArticle',
    summary: 'Create Knowledge Article Draft',
    description: 'Staff or Manager creates a new article in draft state.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['title', 'content'],
        properties: {
          title: { type: 'string', example: 'Nginx Gateway 502 Troubleshooting Runbook' },
          content: { type: 'string', example: '# Nginx Troubleshooting\n1. Check error.log\n2. Inspect upstream keepalive timeout...' },
          category: { type: 'string', example: 'Infrastructure' }
        }
      })
    },
    responses: standardResponses(201, 'Article draft created', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        article: { $ref: '#/components/schemas/KnowledgeArticle' }
      }
    })
  }
};

doc.paths['/api/knowledge/{id}'] = {
  get: {
    tags: ['16. Knowledge Base Articles'],
    operationId: 'getKBArticleById',
    summary: 'Get KB Article Details',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'kb-auth-502-troubleshoot' }],
    responses: standardResponses(200, 'Article found', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        article: { $ref: '#/components/schemas/KnowledgeArticle' }
      }
    })
  },
  put: {
    tags: ['16. Knowledge Base Articles'],
    operationId: 'updateKBArticle',
    summary: 'Update KB Article Content',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    requestBody: {
      content: jsonContent({
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
          category: { type: 'string' }
        }
      })
    },
    responses: standardResponses(200, 'Article updated', { $ref: '#/components/schemas/SuccessResponse' })
  },
  delete: {
    tags: ['16. Knowledge Base Articles'],
    operationId: 'deleteKBArticle',
    summary: 'Delete KB Article (Admin Only)',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    responses: standardResponses(200, 'Article deleted', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/knowledge/{id}/submit'] = {
  post: {
    tags: ['16. Knowledge Base Articles'],
    operationId: 'submitArticleForReview',
    summary: 'Submit Draft Article for Review',
    description: 'Contributor submits draft article to the manager review queue.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    responses: standardResponses(200, 'Article submitted for review', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/knowledge/{id}/approve'] = {
  post: {
    tags: ['16. Knowledge Base Articles'],
    operationId: 'approveKBArticle',
    summary: 'Approve Article (Manager/Admin)',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    responses: standardResponses(200, 'Article approved', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/knowledge/{id}/publish'] = {
  post: {
    tags: ['16. Knowledge Base Articles'],
    operationId: 'publishKBArticle',
    summary: 'Publish Article (Admin Only)',
    description: 'Promotes approved article to published status for tenant and public access.',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    responses: standardResponses(200, 'Article published', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/knowledge/{id}/feedback'] = {
  post: {
    tags: ['16. Knowledge Base Articles'],
    operationId: 'rateKBArticle',
    summary: 'Rate Article Helpfulness (Tenant)',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['helpful'],
        properties: {
          helpful: { type: 'boolean', example: true },
          reason: { type: 'string', example: 'Steps worked accurately.' }
        }
      })
    },
    responses: standardResponses(200, 'Feedback recorded', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/knowledge/{id}/versions'] = {
  get: {
    tags: ['16. Knowledge Base Articles'],
    operationId: 'getKBArticleVersions',
    summary: 'List Article Versions History',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    responses: standardResponses(200, 'Versions history', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        versions: { type: 'array', items: { $ref: '#/components/schemas/KnowledgeVersion' } }
      }
    })
  }
};

// 17. CHAT, PRESENCE & VIDEO MEETINGS
doc.paths['/api/chat/rooms'] = {
  get: {
    tags: ['17. Chat, Presence & Video Meetings'],
    operationId: 'getUserChatRooms',
    summary: 'List User Chat Conversation Rooms',
    description: 'Returns all ticket discussion rooms, department group rooms, and direct message rooms for current user.',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'Chat rooms list', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        rooms: { type: 'array', items: { $ref: '#/components/schemas/ChatRoom' } }
      }
    })
  }
};

doc.paths['/api/chat/rooms/{roomId}'] = {
  get: {
    tags: ['17. Chat, Presence & Video Meetings'],
    operationId: 'getChatRoomById',
    summary: 'Get Chat Room Details',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'roomId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: standardResponses(200, 'Room details', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        room: { $ref: '#/components/schemas/ChatRoom' }
      }
    })
  }
};

doc.paths['/api/chat/rooms/ticket'] = {
  post: {
    tags: ['17. Chat, Presence & Video Meetings'],
    operationId: 'createOrFindTicketRoom',
    summary: 'Find or Create Ticket Chat Room',
    description: 'Auto-creates chat room binding the ticket creator tenant and assigned technicians.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['ticketId'],
        properties: {
          ticketId: { type: 'string', format: 'uuid', example: 'c1f7a840-a108-4e89-9a67-27b233a7e0f2' },
          name: { type: 'string', example: 'Discussion: TICK-20261022-4821' }
        }
      })
    },
    responses: standardResponses(200, 'Room ready', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        room: { $ref: '#/components/schemas/ChatRoom' }
      }
    })
  }
};

doc.paths['/api/chat/rooms/department'] = {
  post: {
    tags: ['17. Chat, Presence & Video Meetings'],
    operationId: 'createDepartmentRoom',
    summary: 'Create Department Team Room',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['departmentId'],
        properties: {
          departmentId: { type: 'string', example: 'dept-infra-01' },
          name: { type: 'string', example: 'Infrastructure Tech Sync' }
        }
      })
    },
    responses: standardResponses(200, 'Department room created', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/chat/rooms/direct'] = {
  post: {
    tags: ['17. Chat, Presence & Video Meetings'],
    operationId: 'createDirectRoom',
    summary: 'Find or Create 1-on-1 Direct Message Room',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', format: 'uuid', example: 'a9b8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d' },
          name: { type: 'string' }
        }
      })
    },
    responses: standardResponses(200, 'Direct message room ready', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        room: { $ref: '#/components/schemas/ChatRoom' }
      }
    })
  }
};

doc.paths['/api/chat/rooms/{roomId}/messages'] = {
  get: {
    tags: ['17. Chat, Presence & Video Meetings'],
    operationId: 'getRoomMessages',
    summary: 'Get Room Message History',
    description: 'Paged message history with attachment links.',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'roomId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
      { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } }
    ],
    responses: standardResponses(200, 'Messages list', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        messages: { type: 'array', items: { $ref: '#/components/schemas/ChatMessage' } }
      }
    })
  }
};

doc.paths['/api/chat/messages'] = {
  post: {
    tags: ['17. Chat, Presence & Video Meetings'],
    operationId: 'sendChatMessage',
    summary: 'Send Chat Message (REST Fallback)',
    description: 'Alternative REST endpoint to post a message and broadcast `new-message` to Socket.IO clients.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['roomId', 'message'],
        properties: {
          roomId: { type: 'string', format: 'uuid', example: '8f9e0d1c-2b3a-4c5d-6e7f-8a9b0c1d2e3f' },
          message: { type: 'string', example: 'We have updated DNS records and verified latency.' },
          messageType: { type: 'string', enum: ['text', 'image', 'file'], default: 'text' }
        }
      })
    },
    responses: standardResponses(201, 'Message sent', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { $ref: '#/components/schemas/ChatMessage' }
      }
    })
  }
};

doc.paths['/api/chat/upload'] = {
  post: {
    tags: ['17. Chat, Presence & Video Meetings'],
    operationId: 'uploadChatFile',
    summary: 'Upload Chat File / Image Attachment',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: multipartContent({
        type: 'object',
        required: ['file'],
        properties: {
          file: { type: 'string', format: 'binary', description: 'File to attach (max 10MB)' }
        }
      })
    },
    responses: standardResponses(200, 'File uploaded', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        fileUrl: { type: 'string', example: '/uploads/chat/chat-1729600000.png' },
        originalName: { type: 'string', example: 'network_graph.png' },
        mimeType: { type: 'string', example: 'image/png' },
        size: { type: 'integer', example: 45210 }
      }
    })
  }
};

doc.paths['/api/chat/online-users'] = {
  get: {
    tags: ['17. Chat, Presence & Video Meetings'],
    operationId: 'getOnlineUsers',
    summary: 'List Connected Online Users',
    description: 'Returns real-time presence indicators of users connected to Socket.IO.',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'Online users list', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        users: { type: 'array', items: { type: 'string', format: 'uuid' } }
      }
    })
  }
};

doc.paths['/api/chat/meeting-invite'] = {
  post: {
    tags: ['17. Chat, Presence & Video Meetings'],
    operationId: 'sendMeetingInvite',
    summary: 'Send Video / Google Meet Call Invitation',
    description: 'Dispatches video meeting invitation with Google Meet / Zoom link, optional passcode, chat notification, and calendar email dispatch.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['meetingUrl'],
        properties: {
          meetingUrl: { type: 'string', example: 'https://meet.google.com/abc-defg-hij' },
          recipientEmail: { type: 'string', format: 'email', example: 'client@example.com' },
          recipientEmails: { type: 'array', items: { type: 'string' } },
          roomId: { type: 'string', format: 'uuid' },
          title: { type: 'string', example: 'Technical Screen Share on Incident 4821' },
          notes: { type: 'string', example: 'Reviewing gateway logs and load balancer traces together.' },
          scheduledTime: { type: 'string', format: 'date-time' },
          durationMinutes: { type: 'integer', example: 30 }
        }
      })
    },
    responses: standardResponses(200, 'Meeting invitation sent', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

// 18. DASHBOARDS & ANALYTICS
doc.paths['/api/dashboard/admin'] = {
  get: {
    tags: ['18. Dashboards & Analytics'],
    operationId: 'getAdminDashboardMetrics',
    summary: 'Admin Operational Dashboard Metrics',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'Admin metrics', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        stats: {
          type: 'object',
          properties: {
            totalTickets: { type: 'integer', example: 124 },
            openTickets: { type: 'integer', example: 18 },
            resolvedTickets: { type: 'integer', example: 106 },
            slaComplianceRate: { type: 'string', example: '96.4%' }
          }
        }
      }
    })
  }
};

doc.paths['/api/dashboard/ceo'] = {
  get: {
    tags: ['18. Dashboards & Analytics'],
    operationId: 'getCeoExecutiveDashboard',
    summary: 'CEO High-Level Executive Dashboard',
    description: 'High-privilege overview of company performance across all tenant organizations and departments.',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'CEO dashboard metrics', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        performance: { type: 'object' }
      }
    })
  }
};

doc.paths['/api/dashboard/tickets/stats'] = {
  get: {
    tags: ['18. Dashboards & Analytics'],
    operationId: 'getTicketStatsOverview',
    summary: 'Ticket Breakdown Statistics by Status & Priority',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'Ticket statistics', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        stats: { type: 'object' }
      }
    })
  }
};

// 19. REPORTS & EXPORTS
doc.paths['/api/reports/tickets'] = {
  get: {
    tags: ['19. Reports & Exports'],
    operationId: 'getTicketReports',
    summary: 'Comprehensive Ticket Operational Reports',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'Ticket reports', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/reports/{type}/export'] = {
  get: {
    tags: ['19. Reports & Exports'],
    operationId: 'exportReportData',
    summary: 'Export Report as Excel / CSV File',
    description: 'Downloads an Excel (.xlsx) file containing operational records.',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'type', in: 'path', required: true, schema: { type: 'string', enum: ['tickets', 'departments', 'staff', 'tenants', 'comprehensive', 'all'] } }
    ],
    responses: {
      '200': {
        description: 'Excel spreadsheet binary stream',
        content: {
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
            schema: { type: 'string', format: 'binary' }
          }
        }
      }
    }
  }
};

// 20. FEEDBACK & SURVEYS
doc.paths['/api/feedback'] = {
  get: {
    tags: ['20. Feedback & Surveys'],
    operationId: 'listFeedback',
    summary: 'List Tenant Feedback & Satisfaction Ratings',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'Feedback list', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: '#/components/schemas/FeedbackItem' } }
      }
    })
  },
  post: {
    tags: ['20. Feedback & Surveys'],
    operationId: 'submitFeedback',
    summary: 'Submit Service Feedback & Rating',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['subject', 'message'],
        properties: {
          subject: { type: 'string', example: 'Helpdesk response speed' },
          message: { type: 'string', example: 'The network team addressed our issue in less than 30 minutes.' },
          rating: { type: 'integer', minimum: 1, maximum: 5, example: 5 }
        }
      })
    },
    responses: standardResponses(201, 'Feedback submitted', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

doc.paths['/api/feedback/{id}'] = {
  get: {
    tags: ['20. Feedback & Surveys'],
    operationId: 'getFeedbackById',
    summary: 'Get Feedback Details',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    responses: standardResponses(200, 'Feedback item', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        feedback: { $ref: '#/components/schemas/FeedbackItem' }
      }
    })
  }
};

doc.paths['/api/feedback/{id}/replies'] = {
  post: {
    tags: ['20. Feedback & Surveys'],
    operationId: 'addFeedbackReply',
    summary: 'Reply to Feedback',
    security: [{ BearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', example: 'Thank you for your kind feedback! We are thrilled to hear that.' }
        }
      })
    },
    responses: standardResponses(200, 'Reply posted', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

// 21. AUDIT LOGS & COMPLIANCE
doc.paths['/api/audit'] = {
  get: {
    tags: ['21. Audit Logs & Compliance'],
    operationId: 'getAuditLogs',
    summary: 'Query Security Audit Logs',
    description: 'Retrieves chronological audit trail of user logins, role modifications, status changes, and administrative actions.',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
      { name: 'userId', in: 'query', schema: { type: 'string' } },
      { name: 'action', in: 'query', schema: { type: 'string' } },
      { name: 'entityType', in: 'query', schema: { type: 'string' } }
    ],
    responses: standardResponses(200, 'Audit logs retrieved', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: '#/components/schemas/AuditLogEntry' } },
        pagination: { $ref: '#/components/schemas/PaginationMeta' }
      }
    })
  }
};

doc.paths['/api/audit/actions'] = {
  get: {
    tags: ['21. Audit Logs & Compliance'],
    operationId: 'getAuditActions',
    summary: 'List Distinct Audit Action Types',
    security: [{ BearerAuth: [] }],
    responses: standardResponses(200, 'Action types list', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        actions: { type: 'array', items: { type: 'string' } }
      }
    })
  }
};

doc.paths['/api/audit/export'] = {
  get: {
    tags: ['21. Audit Logs & Compliance'],
    operationId: 'exportAuditLogs',
    summary: 'Export Audit Logs (CSV / Excel)',
    security: [{ BearerAuth: [] }],
    responses: {
      '200': {
        description: 'Audit log export download',
        content: {
          'text/csv': { schema: { type: 'string' } }
        }
      }
    }
  }
};

// 22. DIRECT EMAIL & COMMUNICATIONS
doc.paths['/api/send-email'] = {
  post: {
    tags: ['22. Direct Email & Communications'],
    operationId: 'sendDirectEmailRoot',
    summary: 'Direct Email Dispatcher',
    description: 'Sends custom email message with HTML/text body to an external email address using SMTP settings.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: jsonContent({
        type: 'object',
        required: ['to', 'subject', 'message'],
        properties: {
          to: { type: 'string', format: 'email', example: 'client.security@external.com' },
          toName: { type: 'string', example: 'Security Officer' },
          subject: { type: 'string', example: 'Critical Ticket Notification TICK-20261022-4821' },
          message: { type: 'string', example: 'Our operations team has completed firewall rules updates.' }
        }
      })
    },
    responses: standardResponses(200, 'Email sent', { $ref: '#/components/schemas/SuccessResponse' })
  }
};

// 23. STATIC UPLOADS
doc.paths['/uploads/{subfolder}/{filename}'] = {
  get: {
    tags: ['23. Static Uploads'],
    operationId: 'getUploadedStaticFile',
    summary: 'Retrieve Static Uploaded File',
    description: 'Fetches static uploaded file (ticket attachment, avatar, chat file, or knowledge document). Cross-Origin Resource Policy: `cross-origin`.',
    security: [],
    parameters: [
      { name: 'subfolder', in: 'path', required: true, schema: { type: 'string', enum: ['tickets', 'users', 'chat', 'knowledge'] }, example: 'tickets' },
      { name: 'filename', in: 'path', required: true, schema: { type: 'string' }, example: 'gateway_logs-1729600000000.log' }
    ],
    responses: {
      '200': {
        description: 'Raw file binary stream',
        content: {
          '*/*': { schema: { type: 'string', format: 'binary' } }
        }
      },
      '404': {
        description: 'File not found'
      }
    }
  }
};

console.log(`Writing valid YAML to: ${targetPath}`);
const yamlOutput = YAML.stringify(doc, { indent: 2 });
fs.writeFileSync(targetPath, yamlOutput, 'utf8');

console.log('✅ openapi.yaml generated successfully!');
console.log(`File size: ${(Buffer.byteLength(yamlOutput, 'utf8') / 1024).toFixed(1)} KB`);
console.log(`Total paths defined: ${Object.keys(doc.paths).length}`);
console.log(`Total components schemas: ${Object.keys(doc.components.schemas).length}`);
