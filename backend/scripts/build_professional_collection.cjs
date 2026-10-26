const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'docs', 'DMS_Postman_Collection.json');
const rawData = fs.readFileSync(filePath, 'utf8');
const collection = JSON.parse(rawData);

console.log('Original collection name:', collection.info.name);
console.log('Original items count:', collection.item.length);

// 1. Update Collection Info
collection.info.name = 'DMS Help Desk Management System - Professional API Testing Collection';
collection.info.description = `# DMS Help Desk Management System - Professional Test & Integration API Suite

Welcome to the official, enterprise-grade Postman Collection for the **DMS (Help Desk Management System)** backend. This collection is engineered for comprehensive testing, CI/CD automated test runs (Newman / Postman CLI), and developer integration.

---

### 🚀 Quick-Start Instructions

1. **Importing into Postman:**
   - In Postman, click **Import** (top-left).
   - Select or drag-and-drop the \`DMS_Postman_Collection.json\` file.
   - The collection will load with all 23 domain modules organized sequentially for automated testing.

2. **Zero-Configuration Execution:**
   - The collection includes a **Collection-Level Pre-Request Script** that automatically signs in as **System Admin** if no JWT \`bearerToken\` is present.
   - You can click **Send** on almost any authenticated request immediately!
   - You can run the entire collection in the **Postman Collection Runner** or via **Newman** from start to finish.

3. **Role-Based Testing Credentials (Pre-Seeded):**
   - **System Admin:** \`admin\` / \`password\` (Full system permissions)
   - **CEO Executive:** \`ceo\` / \`password\` (Executive dashboards, analytics, ticket oversight)
   - **Department Manager:** \`manager\` / \`password\` (Department queue, staff assignments, SLA escalations)
   - **Technical Staff:** \`staff\` / \`password\` (Ticket resolution, internal notes, direct chat)
   - **Customer / Tenant:** \`tenant\` / \`password\` (Ticket submission, public KB, survey feedback)

4. **Dynamic Resource Chaining:**
   - Entity IDs and tokens (\`bearerToken\`, \`adminToken\`, \`tenantToken\`, \`managerToken\`, \`staffToken\`, \`ceoToken\`, \`testTicketId\`, \`testTrackNumber\`, \`testUserId\`, \`testDepartmentId\`, \`testCategoryId\`, \`testSlaId\`, \`testTenantId\`, \`testNoticeId\`, \`testArticleId\`, \`testFeedbackId\`, \`testRoomId\`, etc.) are captured automatically when requests execute.
   - Dynamic timestamps (\`{{$timestamp}}\`) are used in creation payloads to prevent unique key collisions.

---

### 🛡️ Authentication Model
- **Bearer Token:** Header \`Authorization: Bearer {{bearerToken}}\`
- **Tenant Token:** Specialized tenant operations (e.g. ticket creation) automatically use \`{{tenantToken}}\`.
- **Refresh Token:** Supported via HTTP-only \`refreshToken\` cookie via \`POST /api/auth/refresh\`.

---

### ⚡ Real-Time Socket.IO Integration
- Server URL: \`ws://localhost:5000\` (path: \`/socket.io\`)
- Supports chat messaging, typing indicators, user presence, and real-time ticket alerts.
`;

// 2. Collection Variables
collection.variable = [
  {
    key: 'baseUrl',
    value: 'http://localhost:5000',
    type: 'string',
    description: 'Backend base URL (Default port 5000 or 5005)'
  },
  {
    key: 'bearerToken',
    value: '',
    type: 'string',
    description: 'Active JWT Bearer Token (automatically captured from login)'
  },
  {
    key: 'adminToken',
    value: '',
    type: 'string',
    description: 'System Admin JWT Token'
  },
  {
    key: 'tenantToken',
    value: '',
    type: 'string',
    description: 'Tenant User JWT Token (required for ticket submission)'
  },
  {
    key: 'managerToken',
    value: '',
    type: 'string',
    description: 'Department Manager JWT Token'
  },
  {
    key: 'staffToken',
    value: '',
    type: 'string',
    description: 'Technical Staff JWT Token'
  },
  {
    key: 'ceoToken',
    value: '',
    type: 'string',
    description: 'CEO Executive JWT Token'
  },
  {
    key: 'testUserId',
    value: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    type: 'string',
    description: 'Target User ID (Default: Seeded Manager User)'
  },
  {
    key: 'testDepartmentId',
    value: 'IT-01',
    type: 'string',
    description: 'Target Department ID (Default: Seeded IT Support Department)'
  },
  {
    key: 'testCategoryId',
    value: 'cat00001-0000-0000-0000-000000000001',
    type: 'string',
    description: 'Target Ticket Category ID (Default: Seeded Hardware Category)'
  },
  {
    key: 'testSlaId',
    value: 'sla00001-0000-0000-0000-000000000001',
    type: 'string',
    description: 'Target SLA Policy ID (Default: Seeded Critical SLA Policy)'
  },
  {
    key: 'testTenantId',
    value: '11111111-1111-1111-1111-111111111111',
    type: 'string',
    description: 'Target Tenant Organization ID (Default: Seeded City Housing Office)'
  },
  {
    key: 'testMatrixId',
    value: 'uddddddd-dddd-dddd-dddd-dddddddddddd',
    type: 'string',
    description: 'Target User-Department Matrix ID (Default: Seeded Assignment)'
  },
  {
    key: 'testTicketId',
    value: '',
    type: 'string',
    description: 'Target Ticket ID (populated automatically on ticket creation/retrieval)'
  },
  {
    key: 'testTrackNumber',
    value: '',
    type: 'string',
    description: 'Target Ticket Public Tracking Number (populated automatically)'
  },
  {
    key: 'testNoticeId',
    value: '',
    type: 'string',
    description: 'Target Notice ID (populated automatically on notice creation/retrieval)'
  },
  {
    key: 'testArticleId',
    value: '',
    type: 'string',
    description: 'Target Knowledge Article ID (populated automatically on KB creation)'
  },
  {
    key: 'testFeedbackId',
    value: '',
    type: 'string',
    description: 'Target Feedback ID (populated automatically on feedback creation)'
  },
  {
    key: 'testRoomId',
    value: '',
    type: 'string',
    description: 'Target Chat Room ID (populated automatically on room creation/list)'
  },
  {
    key: 'testMessageId',
    value: '',
    type: 'string',
    description: 'Target Chat Message ID (populated automatically on message send)'
  },
  {
    key: 'testNotificationId',
    value: '',
    type: 'string',
    description: 'Target Notification ID (populated automatically from notifications list)'
  },
  {
    key: 'reportType',
    value: 'tickets',
    type: 'string',
    description: 'Report Export Type (tickets, departments, staff, tenants)'
  }
];

// 3. Collection-Level Events (Auto-login Pre-request Script)
collection.event = [
  {
    listen: 'prerequest',
    script: {
      type: 'text/javascript',
      exec: [
        '// Collection-Level Pre-Request Script: Ensure admin bearerToken exists',
        'const currentToken = pm.collectionVariables.get("bearerToken");',
        'const baseUrl = pm.collectionVariables.get("baseUrl") || "http://localhost:5000";',
        '',
        'if (!currentToken && !pm.request.url.getPath().includes("/api/auth/login")) {',
        '    pm.sendRequest({',
        '        url: baseUrl + "/api/auth/login",',
        '        method: "POST",',
        '        header: { "Content-Type": "application/json" },',
        '        body: {',
        '            mode: "raw",',
        '            raw: JSON.stringify({ identifier: "admin", password: "password" })',
        '        }',
        '    }, function (err, res) {',
        '        if (!err && res.code === 200) {',
        '            const data = res.json();',
        '            const token = data.token || data.data?.accessToken;',
        '            if (token) {',
        '                pm.collectionVariables.set("bearerToken", token);',
        '                pm.collectionVariables.set("adminToken", token);',
        '                console.log("⚡ Auto-acquired admin JWT bearer token for collection test run.");',
        '            }',
        '        }',
        '    });',
        '}'
      ]
    }
  }
];

// 4. Standard Test Script Generator
function generateTestScript(reqName, method, path, customAssertions = []) {
  const lines = [
    `// Automated Test Script for: [${method}] ${reqName}`,
    'pm.test("Status code is successful (2xx)", function () {',
    '    pm.expect(pm.response.code).to.be.oneOf([200, 201, 204]);',
    '});',
    '',
    'pm.test("Response time is acceptable (< 3000ms)", function () {',
    '    pm.expect(pm.response.responseTime).to.be.below(3000);',
    '});',
    ''
  ];

  // If response has JSON
  lines.push(
    'pm.test("Response envelope is valid JSON with success flag", function () {',
    '    const contentType = pm.response.headers.get("content-type");',
    '    if (contentType && contentType.includes("application/json")) {',
    '        const jsonData = pm.response.json();',
    '        pm.expect(jsonData).to.be.an("object");',
    '        pm.expect(jsonData.success).to.be.true;',
    '    }',
    '});'
  );

  if (customAssertions.length > 0) {
    lines.push('');
    lines.push(...customAssertions);
  }

  return {
    listen: 'test',
    script: {
      type: 'text/javascript',
      exec: lines
    }
  };
}

// 5. Enhance each item in collection
function enhanceItems(items, folderName = '') {
  for (const item of items) {
    const curFolder = folderName ? folderName + ' > ' + item.name : item.name;
    if (item.item) {
      enhanceItems(item.item, curFolder);
    } else if (item.request) {
      const req = item.request;
      const rawUrl = req.url.raw || '';
      const method = req.method;

      // Fix URL path variables mapping
      if (req.url.variable && Array.isArray(req.url.variable)) {
        req.url.variable.forEach(v => {
          if (v.key === 'id') {
            if (curFolder.includes('User Management')) v.value = '{{testUserId}}';
            else if (curFolder.includes('Department Management')) v.value = '{{testDepartmentId}}';
            else if (curFolder.includes('Assignment Matrix')) v.value = '{{testMatrixId}}';
            else if (curFolder.includes('Tickets - Notifications')) v.value = '{{testNotificationId}}';
            else if (curFolder.includes('Tickets')) v.value = '{{testTicketId}}';
            else if (curFolder.includes('Ticket Categories')) v.value = '{{testCategoryId}}';
            else if (curFolder.includes('Service Level Agreements')) v.value = '{{testSlaId}}';
            else if (curFolder.includes('Tenant Management')) v.value = '{{testTenantId}}';
            else if (curFolder.includes('Notices')) v.value = '{{testNoticeId}}';
            else if (curFolder.includes('Knowledge Base')) v.value = '{{testArticleId}}';
            else if (curFolder.includes('Feedback')) v.value = '{{testFeedbackId}}';
          } else if (v.key === 'userId') {
            v.value = '{{testUserId}}';
          } else if (v.key === 'departmentId') {
            v.value = '{{testDepartmentId}}';
          } else if (v.key === 'ticketId') {
            v.value = '{{testTicketId}}';
          } else if (v.key === 'trackNumber') {
            v.value = '{{testTrackNumber}}';
          } else if (v.key === 'roomId') {
            v.value = '{{testRoomId}}';
          } else if (v.key === 'messageId') {
            v.value = '{{testMessageId}}';
          } else if (v.key === 'type') {
            v.value = '{{reportType}}';
          } else if (v.key === 'subfolder') {
            v.value = 'tickets';
          } else if (v.key === 'filename') {
            v.value = 'sample.txt';
          }
        });
      }

      // Add custom assertions and dynamic variable capture
      const customAssertions = [];

      // ─── LOGIN REQUESTS ───
      if (rawUrl.includes('/api/auth/login')) {
        // preserve or generate custom login test
        customAssertions.push(
          'const response = pm.response.json();',
          'const token = response.token || response.data?.accessToken;',
          'if (token) {',
          '    pm.collectionVariables.set("bearerToken", token);',
          '    if (pm.request.body && pm.request.body.raw && pm.request.body.raw.includes("tenant")) {',
          '        pm.collectionVariables.set("tenantToken", token);',
          '    } else if (pm.request.body && pm.request.body.raw && pm.request.body.raw.includes("manager")) {',
          '        pm.collectionVariables.set("managerToken", token);',
          '    } else if (pm.request.body && pm.request.body.raw && pm.request.body.raw.includes("staff")) {',
          '        pm.collectionVariables.set("staffToken", token);',
          '    } else if (pm.request.body && pm.request.body.raw && pm.request.body.raw.includes("ceo")) {',
          '        pm.collectionVariables.set("ceoToken", token);',
          '    } else {',
          '        pm.collectionVariables.set("adminToken", token);',
          '    }',
          '    console.log("✅ Bearer token successfully saved to collection variables!");',
          '}'
        );
      }

      // ─── USER CREATION & RETRIEVAL ───
      if (rawUrl.includes('/api/users') && method === 'POST') {
        customAssertions.push(
          'const resData = pm.response.json();',
          'const newId = resData.data?.id || resData.id;',
          'if (newId) {',
          '    pm.collectionVariables.set("testUserId", newId);',
          '    console.log("Captured testUserId:", newId);',
          '}'
        );
      }
      if (rawUrl.includes('/api/users') && method === 'GET' && !rawUrl.includes('/roles') && !rawUrl.includes('/:id')) {
        customAssertions.push(
          'const resData = pm.response.json();',
          'if (Array.isArray(resData.data) && resData.data.length > 0) {',
          '    const sampleUser = resData.data[0];',
          '    if (sampleUser.id) pm.collectionVariables.set("testUserId", sampleUser.id);',
          '}'
        );
      }

      // ─── DEPARTMENT CREATION & RETRIEVAL ───
      if (rawUrl.includes('/api/departments') && method === 'POST') {
        customAssertions.push(
          'const resData = pm.response.json();',
          'const newId = resData.data?.id || resData.id;',
          'if (newId) {',
          '    pm.collectionVariables.set("testDepartmentId", newId);',
          '    console.log("Captured testDepartmentId:", newId);',
          '}'
        );
      }
      if (rawUrl.includes('/api/departments') && method === 'GET' && !rawUrl.includes('/:id')) {
        customAssertions.push(
          'const resData = pm.response.json();',
          'const list = Array.isArray(resData.data) ? resData.data : (Array.isArray(resData) ? resData : []);',
          'if (list.length > 0 && list[0].id) {',
          '    pm.collectionVariables.set("testDepartmentId", list[0].id);',
          '}'
        );
      }

      // ─── TICKET CREATION & RETRIEVAL ───
      if (rawUrl.includes('/api/tickets') && method === 'POST' && req.url.path.length === 2) {
        // Ticket submission
        customAssertions.push(
          'const resData = pm.response.json();',
          'const newTicket = resData.data || resData;',
          'if (newTicket.id) {',
          '    pm.collectionVariables.set("testTicketId", newTicket.id);',
          '    console.log("Captured testTicketId:", newTicket.id);',
          '}',
          'const trackNum = newTicket.trackNumber || newTicket.track_number;',
          'if (trackNum) {',
          '    pm.collectionVariables.set("testTrackNumber", trackNum);',
          '    console.log("Captured testTrackNumber:", trackNum);',
          '}'
        );

        // Pre-request script to ensure tenantToken is populated
        item.event = item.event || [];
        const existingPre = item.event.find(e => e.listen === 'prerequest');
        const preScriptLines = [
          '// Pre-request Script: Ensure tenantToken exists for ticket creation',
          'if (!pm.collectionVariables.get("tenantToken")) {',
          '    pm.sendRequest({',
          '        url: (pm.collectionVariables.get("baseUrl") || "http://localhost:5000") + "/api/auth/login",',
          '        method: "POST",',
          '        header: { "Content-Type": "application/json" },',
          '        body: {',
          '            mode: "raw",',
          '            raw: JSON.stringify({ identifier: "tenant", password: "password" })',
          '        }',
          '    }, function (err, res) {',
          '        if (!err && res.code === 200) {',
          '            const data = res.json();',
          '            const tToken = data.token || data.data?.accessToken;',
          '            if (tToken) {',
          '                pm.collectionVariables.set("tenantToken", tToken);',
          '                console.log("⚡ Auto-acquired tenant JWT token for ticket submission.");',
          '            }',
          '        }',
          '    });',
          '}'
        ];
        if (existingPre) {
          existingPre.script.exec = preScriptLines;
        } else {
          item.event.push({
            listen: 'prerequest',
            script: { type: 'text/javascript', exec: preScriptLines }
          });
        }

        // Configure auth to use tenant token with fallback to bearerToken
        req.auth = {
          type: 'bearer',
          bearer: [
            {
              key: 'token',
              value: '{{tenantToken}}',
              type: 'string'
            }
          ]
        };

        // Fix formdata category and departmentId
        if (req.body && req.body.formdata) {
          req.body.formdata.forEach(fd => {
            if (fd.key === 'category') fd.value = 'Hardware';
            if (fd.key === 'departmentId') fd.value = '{{testDepartmentId}}';
          });
        }
      }

      if (rawUrl.includes('/api/tickets') && method === 'GET' && req.url.path.length === 2) {
        customAssertions.push(
          'const resData = pm.response.json();',
          'if (Array.isArray(resData.data) && resData.data.length > 0) {',
          '    const first = resData.data[0];',
          '    if (!pm.collectionVariables.get("testTicketId") && first.id) {',
          '        pm.collectionVariables.set("testTicketId", first.id);',
          '    }',
          '    if (!pm.collectionVariables.get("testTrackNumber") && (first.trackNumber || first.track_number)) {',
          '        pm.collectionVariables.set("testTrackNumber", first.trackNumber || first.track_number);',
          '    }',
          '}'
        );
      }

      // ─── NOTIFICATIONS ───
      if (rawUrl.includes('/api/tickets/notifications') && method === 'GET') {
        customAssertions.push(
          'const resData = pm.response.json();',
          'if (Array.isArray(resData.data) && resData.data.length > 0) {',
          '    pm.collectionVariables.set("testNotificationId", resData.data[0].id);',
          '}'
        );
      }

      // ─── TICKET CATEGORIES ───
      if (rawUrl.includes('/api/ticket-categories') && method === 'POST') {
        customAssertions.push(
          'const resData = pm.response.json();',
          'const newId = resData.data?.id || resData.id;',
          'if (newId) pm.collectionVariables.set("testCategoryId", newId);'
        );
      }

      // ─── SLA POLICIES ───
      if (rawUrl.includes('/api/sla') && method === 'POST') {
        customAssertions.push(
          'const resData = pm.response.json();',
          'const newId = resData.data?.id || resData.id;',
          'if (newId) pm.collectionVariables.set("testSlaId", newId);'
        );
      }

      // ─── TENANTS ───
      if (rawUrl.includes('/api/tenants') && method === 'POST') {
        customAssertions.push(
          'const resData = pm.response.json();',
          'const newId = resData.data?.id || resData.id;',
          'if (newId) pm.collectionVariables.set("testTenantId", newId);'
        );
      }

      // ─── NOTICES ───
      if (rawUrl.includes('/api/notices') && method === 'POST') {
        customAssertions.push(
          'const resData = pm.response.json();',
          'const newId = resData.data?.id || resData.id;',
          'if (newId) pm.collectionVariables.set("testNoticeId", newId);'
        );
      }

      // ─── KNOWLEDGE BASE ───
      if (rawUrl.includes('/api/knowledge') && method === 'POST' && !rawUrl.includes('/categories')) {
        customAssertions.push(
          'const resData = pm.response.json();',
          'const newId = resData.data?.id || resData.id;',
          'if (newId) pm.collectionVariables.set("testArticleId", newId);'
        );
      }

      // ─── FEEDBACK ───
      if (rawUrl.includes('/api/feedback') && method === 'POST' && !rawUrl.includes('/replies')) {
        customAssertions.push(
          'const resData = pm.response.json();',
          'const newId = resData.data?.id || resData.id;',
          'if (newId) pm.collectionVariables.set("testFeedbackId", newId);'
        );
      }

      // ─── CHAT ROOMS & MESSAGES ───
      if (rawUrl.includes('/api/chat/rooms') && method === 'POST') {
        customAssertions.push(
          'const resData = pm.response.json();',
          'const newId = resData.data?.id || resData.id;',
          'if (newId) pm.collectionVariables.set("testRoomId", newId);'
        );
      }
      if (rawUrl.includes('/api/chat/messages') && method === 'POST') {
        customAssertions.push(
          'const resData = pm.response.json();',
          'const newId = resData.data?.id || resData.id;',
          'if (newId) pm.collectionVariables.set("testMessageId", newId);'
        );
      }

      // Attach test script to request
      item.event = item.event || [];
      const testIdx = item.event.findIndex(e => e.listen === 'test');
      const generatedTest = generateTestScript(item.name, method, rawUrl, customAssertions);
      if (testIdx >= 0) {
        item.event[testIdx] = generatedTest;
      } else {
        item.event.push(generatedTest);
      }
    }
  }
}

enhanceItems(collection.item);

// 6. Add Dedicated Multi-Role Login Requests into "02. Authentication & Identity"
const authFolder = collection.item.find(f => f.name.includes('Authentication & Identity'));
if (authFolder && Array.isArray(authFolder.item)) {
  const roleLogins = [
    {
      name: 'Authenticate as Tenant User (tenant)',
      role: 'tenant',
      desc: 'Authenticates as a Tenant user (\`tenant\` / \`password\`). Saves JWT into \`{{tenantToken}}\` and sets \`{{bearerToken}}\`.'
    },
    {
      name: 'Authenticate as Department Manager (manager)',
      role: 'manager',
      desc: 'Authenticates as Department Manager (\`manager\` / \`password\`). Saves JWT into \`{{managerToken}}\`.'
    },
    {
      name: 'Authenticate as Technical Staff (staff)',
      role: 'staff',
      desc: 'Authenticates as Technical Helpdesk Staff (\`staff\` / \`password\`). Saves JWT into \`{{staffToken}}\`.'
    },
    {
      name: 'Authenticate as CEO Executive (ceo)',
      role: 'ceo',
      desc: 'Authenticates as CEO Executive (\`ceo\` / \`password\`). Saves JWT into \`{{ceoToken}}\` for executive analytics & approvals.'
    }
  ];

  roleLogins.forEach(rl => {
    const existing = authFolder.item.find(i => i.name.includes(rl.name));
    if (!existing) {
      const loginReq = {
        name: rl.name,
        request: {
          method: 'POST',
          header: [{ key: 'Content-Type', value: 'application/json' }],
          url: {
            raw: '{{baseUrl}}/api/auth/login',
            host: ['{{baseUrl}}'],
            path: ['api', 'auth', 'login'],
            query: [],
            variable: []
          },
          description: rl.desc,
          auth: { type: 'noauth' },
          body: {
            mode: 'raw',
            raw: JSON.stringify({ identifier: rl.role, password: 'password' }, null, 2)
          }
        },
        event: [
          generateTestScript(rl.name, 'POST', '{{baseUrl}}/api/auth/login', [
            'const response = pm.response.json();',
            'const token = response.token || response.data?.accessToken;',
            'if (token) {',
            `    pm.collectionVariables.set("${rl.role}Token", token);`,
            `    console.log("✅ ${rl.role} token saved to collection variables!");`,
            '}'
          ])
        ]
      };
      // Insert after the first login item
      authFolder.item.splice(1, 0, loginReq);
    }
  });
}

// 7. Add High-Value Missing Endpoints in Relevant Folders
// (A) Dashboards Folder
const dashFolder = collection.item.find(f => f.name.includes('Dashboards & Analytics'));
if (dashFolder && Array.isArray(dashFolder.item)) {
  const missingDash = [
    {
      name: 'Get Admin Analytics & SLA Metrics',
      method: 'GET',
      path: ['api', 'dashboard', 'admin', 'analytics'],
      desc: 'Retrieves comprehensive SLA metrics, resolution velocity, and breach statistics for admin & executive analytics.'
    },
    {
      name: 'Get Admin SLA Compliance Overview',
      method: 'GET',
      path: ['api', 'dashboard', 'admin', 'sla'],
      desc: 'Returns breakdown of achieved vs breached SLA policies across all active tickets.'
    },
    {
      name: 'Get Department Manager Dashboard',
      method: 'GET',
      path: ['api', 'dashboard', 'manager'],
      desc: 'Fetches workload metrics, active queue, and assigned technician capacity for manager departments.'
    },
    {
      name: 'Get Technical Staff Technician Dashboard',
      method: 'GET',
      path: ['api', 'dashboard', 'staff'],
      desc: 'Returns active personal ticket queue, pending approvals, and response time metrics.'
    },
    {
      name: 'Get Tenant Client Dashboard',
      method: 'GET',
      path: ['api', 'dashboard', 'tenant'],
      desc: 'Returns tenant organization ticket status counts, pending confirmations, and satisfaction ratings.'
    },
    {
      name: 'Get CEO Department Performance Analytics',
      method: 'GET',
      path: ['api', 'dashboard', 'ceo', 'departments'],
      desc: 'Returns cross-departmental comparative performance, SLA efficiency, and resolution speed.'
    },
    {
      name: 'Get Overdue Tickets Alert Dashboard',
      method: 'GET',
      path: ['api', 'dashboard', 'tickets', 'overdue'],
      desc: 'Lists tickets currently in breach of either initial response or resolution SLA.'
    },
    {
      name: 'Get Ticket Trend Charts Data',
      method: 'GET',
      path: ['api', 'dashboard', 'tickets', 'charts'],
      desc: 'Returns monthly volume trends, priority distributions, and categorical breakdown.'
    }
  ];

  missingDash.forEach(md => {
    if (!dashFolder.item.some(i => i.name === md.name)) {
      dashFolder.item.push({
        name: md.name,
        request: {
          method: md.method,
          header: [],
          url: {
            raw: `{{baseUrl}}/${md.path.join('/')}`,
            host: ['{{baseUrl}}'],
            path: md.path,
            query: [],
            variable: []
          },
          description: md.desc,
          auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{bearerToken}}', type: 'string' }] }
        },
        event: [generateTestScript(md.name, md.method, `{{baseUrl}}/${md.path.join('/')}`)]
      });
    }
  });
}

// (B) Reports Folder
const reportFolder = collection.item.find(f => f.name.includes('Reports & Exports'));
if (reportFolder && Array.isArray(reportFolder.item)) {
  const missingReports = [
    {
      name: 'Get Department Performance Report Data',
      method: 'GET',
      path: ['api', 'reports', 'departments'],
      desc: 'Aggregates resolution metrics, reopen counts, and SLA compliance per department.'
    },
    {
      name: 'Get Staff Workload & Performance Report Data',
      method: 'GET',
      path: ['api', 'reports', 'staff'],
      desc: 'Returns individual technician resolution volumes and average time to complete tickets.'
    },
    {
      name: 'Get Tenant Activity & Volume Report Data',
      method: 'GET',
      path: ['api', 'reports', 'tenants'],
      desc: 'Summarizes ticket generation frequency and issue categories across tenant accounts.'
    },
    {
      name: 'Get Caller Assigned Departments for Reporting',
      method: 'GET',
      path: ['api', 'reports', 'my-departments'],
      desc: 'Returns active departments assigned to the authenticated user for report filtering.'
    }
  ];

  missingReports.forEach(mr => {
    if (!reportFolder.item.some(i => i.name === mr.name)) {
      reportFolder.item.push({
        name: mr.name,
        request: {
          method: mr.method,
          header: [],
          url: {
            raw: `{{baseUrl}}/${mr.path.join('/')}`,
            host: ['{{baseUrl}}'],
            path: mr.path,
            query: [],
            variable: []
          },
          description: mr.desc,
          auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{bearerToken}}', type: 'string' }] }
        },
        event: [generateTestScript(mr.name, mr.method, `{{baseUrl}}/${mr.path.join('/')}`)]
      });
    }
  });
}

// (C) Feedback Folder
const fbFolder = collection.item.find(f => f.name.includes('Feedback & Surveys'));
if (fbFolder && Array.isArray(fbFolder.item)) {
  const missingFb = [
    {
      name: 'Get Feedback Discussion Replies Thread',
      method: 'GET',
      path: ['api', 'feedback', ':id', 'replies'],
      variables: [{ key: 'id', value: '{{testFeedbackId}}', description: 'Feedback ID' }],
      desc: 'Fetches conversation thread and administrator responses for a specific feedback submission.'
    },
    {
      name: 'Admin / Staff Respond to Feedback',
      method: 'PATCH',
      path: ['api', 'feedback', ':id', 'respond'],
      variables: [{ key: 'id', value: '{{testFeedbackId}}', description: 'Feedback ID' }],
      desc: 'Submits formal administrative resolution and sets feedback status.',
      body: {
        mode: 'raw',
        raw: JSON.stringify({
          adminResponse: 'Thank you for this feedback. We have addressed the issue in the latest maintenance window.',
          status: 'resolved'
        }, null, 2)
      }
    },
    {
      name: 'Update Feedback Item Metadata',
      method: 'PUT',
      path: ['api', 'feedback', ':id'],
      variables: [{ key: 'id', value: '{{testFeedbackId}}', description: 'Feedback ID' }],
      desc: 'Updates rating, subject, or message of a feedback entry.',
      body: {
        mode: 'raw',
        raw: JSON.stringify({
          subject: 'Updated Feedback Topic',
          message: 'Clarification regarding the portal accessibility issue.',
          rating: 5
        }, null, 2)
      }
    }
  ];

  missingFb.forEach(mf => {
    if (!fbFolder.item.some(i => i.name === mf.name)) {
      fbFolder.item.push({
        name: mf.name,
        request: {
          method: mf.method,
          header: mf.body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
          url: {
            raw: `{{baseUrl}}/${mf.path.join('/')}`,
            host: ['{{baseUrl}}'],
            path: mf.path,
            query: [],
            variable: mf.variables || []
          },
          description: mf.desc,
          auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{bearerToken}}', type: 'string' }] },
          body: mf.body || undefined
        },
        event: [generateTestScript(mf.name, mf.method, `{{baseUrl}}/${mf.path.join('/')}`)]
      });
    }
  });
}

// (D) Audit Logs Folder
const auditFolder = collection.item.find(f => f.name.includes('Audit Logs & Compliance'));
if (auditFolder && Array.isArray(auditFolder.item)) {
  const missingAudit = {
    name: 'Log Custom Security Audit Event',
    method: 'POST',
    path: ['api', 'audit', 'log'],
    desc: 'Logs a custom security, governance, or administrative compliance event into immutable audit trail.',
    body: {
      mode: 'raw',
      raw: JSON.stringify({
        action: 'api_security_probe',
        entityType: 'postman_collection_test',
        entityId: 'probe-001',
        details: { executedBy: 'Postman Automated Runner', timestamp: new Date().toISOString() }
      }, null, 2)
    }
  };
  if (!auditFolder.item.some(i => i.name === missingAudit.name)) {
    auditFolder.item.push({
      name: missingAudit.name,
      request: {
        method: missingAudit.method,
        header: [{ key: 'Content-Type', value: 'application/json' }],
        url: {
          raw: `{{baseUrl}}/${missingAudit.path.join('/')}`,
          host: ['{{baseUrl}}'],
          path: missingAudit.path,
          query: [],
          variable: []
        },
        description: missingAudit.desc,
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{bearerToken}}', type: 'string' }] },
        body: missingAudit.body
      },
      event: [generateTestScript(missingAudit.name, missingAudit.method, `{{baseUrl}}/${missingAudit.path.join('/')}`)]
    });
  }
}

// (E) Knowledge Base Folder
const kbFolder = collection.item.find(f => f.name.includes('Knowledge Base Articles'));
if (kbFolder && Array.isArray(kbFolder.item)) {
  const missingKb = [
    {
      name: 'List Knowledge Base Categories',
      method: 'GET',
      path: ['api', 'knowledge', 'categories'],
      desc: 'Retrieves active knowledge base taxonomy categories and article count summaries.'
    },
    {
      name: 'Create Knowledge Base Category',
      method: 'POST',
      path: ['api', 'knowledge', 'categories'],
      desc: 'Creates a new categorized taxonomy topic for grouping knowledge base articles.',
      body: {
        mode: 'raw',
        raw: JSON.stringify({
          name: 'Portal & Security Guides {{$timestamp}}',
          description: 'Self-help and configuration guides for tenant portal access.'
        }, null, 2)
      }
    },
    {
      name: 'Get Popular Knowledge Base Articles',
      method: 'GET',
      path: ['api', 'knowledge', 'popular'],
      desc: 'Returns most viewed and highest helpfulness rated knowledge articles.'
    },
    {
      name: 'Get Recent Knowledge Base Articles',
      method: 'GET',
      path: ['api', 'knowledge', 'recent'],
      desc: 'Returns newly published and updated articles for staff and tenant self-service.'
    },
    {
      name: 'Full-Text Search Knowledge Articles',
      method: 'GET',
      path: ['api', 'knowledge', 'search'],
      query: [{ key: 'q', value: 'login' }],
      desc: 'Performs full-text keyword search across knowledge article titles, summaries, tags, and content.'
    }
  ];

  missingKb.forEach(mk => {
    if (!kbFolder.item.some(i => i.name === mk.name)) {
      kbFolder.item.push({
        name: mk.name,
        request: {
          method: mk.method,
          header: mk.body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
          url: {
            raw: `{{baseUrl}}/${mk.path.join('/')}${mk.query ? '?' + mk.query.map(q => q.key + '=' + q.value).join('&') : ''}`,
            host: ['{{baseUrl}}'],
            path: mk.path,
            query: mk.query || [],
            variable: []
          },
          description: mk.desc,
          auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{bearerToken}}', type: 'string' }] },
          body: mk.body || undefined
        },
        event: [generateTestScript(mk.name, mk.method, `{{baseUrl}}/${mk.path.join('/')}`)]
      });
    }
  });
}

// (F) Chat Folder
const chatFolder = collection.item.find(f => f.name.includes('Chat, Presence & Video'));
if (chatFolder && Array.isArray(chatFolder.item)) {
  const missingChat = [
    {
      name: 'Get Room Participants List',
      method: 'GET',
      path: ['api', 'chat', 'rooms', ':roomId', 'participants'],
      variables: [{ key: 'roomId', value: '{{testRoomId}}', description: 'Chat Room ID' }],
      desc: 'Returns active members, joined timestamps, and presence status for a chat room.'
    },
    {
      name: 'Mark Room Messages as Read',
      method: 'POST',
      path: ['api', 'chat', 'rooms', ':roomId', 'read'],
      variables: [{ key: 'roomId', value: '{{testRoomId}}', description: 'Chat Room ID' }],
      desc: 'Updates read receipts for caller in the specified room.'
    },
    {
      name: 'Get Total Unread Messages Count',
      method: 'GET',
      path: ['api', 'chat', 'unread'],
      desc: 'Returns aggregate count of unread messages across all active user conversations.'
    },
    {
      name: 'Search Chat Messages Content',
      method: 'GET',
      path: ['api', 'chat', 'search'],
      query: [{ key: 'q', value: 'support' }],
      desc: 'Performs keyword query across caller chat history.'
    },
    {
      name: 'List Registered Chat Contacts',
      method: 'GET',
      path: ['api', 'chat', 'registered-contacts'],
      desc: 'Returns directory of users available for direct 1-on-1 messaging.'
    }
  ];

  missingChat.forEach(mc => {
    if (!chatFolder.item.some(i => i.name === mc.name)) {
      chatFolder.item.push({
        name: mc.name,
        request: {
          method: mc.method,
          header: [],
          url: {
            raw: `{{baseUrl}}/${mc.path.join('/')}${mc.query ? '?' + mc.query.map(q => q.key + '=' + q.value).join('&') : ''}`,
            host: ['{{baseUrl}}'],
            path: mc.path,
            query: mc.query || [],
            variable: mc.variables || []
          },
          description: mc.desc,
          auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{bearerToken}}', type: 'string' }] }
        },
        event: [generateTestScript(mc.name, mc.method, `{{baseUrl}}/${mc.path.join('/')}`)]
      });
    }
  });
}

// 8. Write the finalized collection back
fs.writeFileSync(filePath, JSON.stringify(collection, null, 2), 'utf8');

console.log('Collection successfully upgraded!');

// Recount
let totalRequests = 0;
let totalWithTests = 0;
function countFinal(items) {
  for (const it of items) {
    if (it.item) countFinal(it.item);
    else if (it.request) {
      totalRequests++;
      if (it.event && it.event.some(e => e.listen === 'test')) totalWithTests++;
    }
  }
}
countFinal(collection.item);
console.log(`Total Requests: ${totalRequests}`);
console.log(`Total Requests with Automated Tests: ${totalWithTests}`);
console.log(`Defined Collection Variables: ${collection.variable.length}`);
