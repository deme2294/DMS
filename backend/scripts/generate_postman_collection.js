import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openapiPath = path.resolve(__dirname, '..', 'docs', 'openapi.yaml');
const postmanPath = path.resolve(__dirname, '..', 'docs', 'DMS_Postman_Collection.json');

console.log(`Reading OpenAPI specification from: ${openapiPath}`);
const openapiContent = fs.readFileSync(openapiPath, 'utf8');
const spec = YAML.parse(openapiContent);

// Initialize Postman Collection v2.1.0
const collection = {
  info: {
    name: spec.info.title || 'DMS Help Desk Management System API',
    description: spec.info.description || 'Production-grade API collection for DMS backend',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  variable: [
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
      description: 'JWT token populated automatically after executing POST /api/auth/login'
    }
  ],
  auth: {
    type: 'bearer',
    bearer: [
      {
        key: 'token',
        value: '{{bearerToken}}',
        type: 'string'
      }
    ]
  },
  item: []
};

// Map each tag to a dedicated Postman folder
const tagFolders = new Map();
(spec.tags || []).forEach(tag => {
  const folder = {
    name: tag.name,
    description: tag.description || '',
    item: []
  };
  tagFolders.set(tag.name, folder);
  collection.item.push(folder);
});

// Helper: fallback folder
let defaultFolder = null;
const getDefaultFolder = () => {
  if (!defaultFolder) {
    defaultFolder = { name: 'Other Endpoints', item: [] };
    collection.item.push(defaultFolder);
  }
  return defaultFolder;
};

// Generate realistic example object from schema
const extractExample = (schema) => {
  if (!schema) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.$ref) {
    const schemaName = schema.$ref.split('/').pop();
    const resolved = spec.components?.schemas?.[schemaName];
    if (resolved) return extractExample(resolved);
  }
  if (schema.type === 'object' && schema.properties) {
    const obj = {};
    for (const [k, prop] of Object.entries(schema.properties)) {
      obj[k] = extractExample(prop);
    }
    return obj;
  }
  if (schema.type === 'array' && schema.items) {
    return [extractExample(schema.items)];
  }
  if (schema.type === 'string') {
    if (schema.format === 'date-time') return new Date().toISOString();
    if (schema.format === 'email') return 'user@example.com';
    if (schema.format === 'uuid') return 'c1f7a840-a108-4e89-9a67-27b233a7e0f2';
    if (schema.enum && schema.enum.length > 0) return schema.enum[0];
    return 'string';
  }
  if (schema.type === 'integer' || schema.type === 'number') return 1;
  if (schema.type === 'boolean') return true;
  return 'sample';
};

// Iterate over each path
for (const [pathStr, pathItem] of Object.entries(spec.paths || {})) {
  for (const [method, op] of Object.entries(pathItem)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) continue;

    const opMethod = method.toUpperCase();
    const opTitle = op.summary || `${opMethod} ${pathStr}`;
    const targetTagName = op.tags && op.tags.length > 0 ? op.tags[0] : null;
    const targetFolder = (targetTagName && tagFolders.get(targetTagName)) || getDefaultFolder();

    // Build URL representation
    const pathSegments = pathStr.replace(/^\//, '').split('/');
    const postmanPath = pathSegments.map(seg => {
      if (seg.startsWith('{') && seg.endsWith('}')) {
        return `:${seg.slice(1, -1)}`;
      }
      return seg;
    });

    // Query parameters
    const queryParams = [];
    const pathVariables = [];

    (op.parameters || []).forEach(param => {
      if (param.in === 'query') {
        queryParams.push({
          key: param.name,
          value: String(param.example || param.schema?.default || (param.schema?.enum ? param.schema.enum[0] : '') || ''),
          description: param.description || ''
        });
      } else if (param.in === 'path') {
        pathVariables.push({
          key: param.name,
          value: String(param.example || (param.schema?.format === 'uuid' ? 'c1f7a840-a108-4e89-9a67-27b233a7e0f2' : '1')),
          description: param.description || ''
        });
      }
    });

    // Build Request Object
    const request = {
      method: opMethod,
      header: [],
      url: {
        raw: `{{baseUrl}}${pathStr.replace(/\{(\w+)\}/g, ':$1')}${queryParams.length > 0 ? '?' + queryParams.map(q => `${q.key}=${encodeURIComponent(q.value)}`).join('&') : ''}`,
        host: ['{{baseUrl}}'],
        path: postmanPath,
        query: queryParams,
        variable: pathVariables
      },
      description: op.description || op.summary || ''
    };

    // Auth config
    const isPublic = !op.security || op.security.length === 0;
    if (isPublic) {
      request.auth = { type: 'noauth' };
    } else {
      request.auth = {
        type: 'bearer',
        bearer: [
          { key: 'token', value: '{{bearerToken}}', type: 'string' }
        ]
      };
    }

    // Request Body handling
    if (op.requestBody && op.requestBody.content) {
      const jsonBody = op.requestBody.content['application/json'];
      const formBody = op.requestBody.content['multipart/form-data'];

      if (jsonBody) {
        request.header.push({ key: 'Content-Type', value: 'application/json' });
        const exampleData = jsonBody.example || extractExample(jsonBody.schema) || {};
        request.body = {
          mode: 'raw',
          raw: JSON.stringify(exampleData, null, 2)
        };
      } else if (formBody) {
        const formDataItems = [];
        const props = formBody.schema?.properties || {};
        for (const [k, p] of Object.entries(props)) {
          if (p.format === 'binary') {
            formDataItems.push({
              key: k,
              type: 'file',
              src: ''
            });
          } else {
            formDataItems.push({
              key: k,
              value: String(p.example || (p.enum ? p.enum[0] : 'sample')),
              type: 'text'
            });
          }
        }
        request.body = {
          mode: 'formdata',
          formdata: formDataItems
        };
      }
    }

    // Postman Request Item
    const postmanItem = {
      name: opTitle,
      request
    };

    // Auto-save JWT token in tests if this is Login
    if (op.operationId === 'loginUser' || pathStr === '/api/auth/login') {
      request.body = {
        mode: 'raw',
        raw: JSON.stringify({ identifier: 'admin', password: 'password' }, null, 2)
      };
      postmanItem.event = [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              'const response = pm.response.json();',
              'const token = response.token || response.data?.accessToken;',
              'if (token) {',
              '    pm.collectionVariables.set("bearerToken", token);',
              '    console.log("✅ Bearer token successfully captured and saved to collection variables!");',
              '}'
            ]
          }
        }
      ];
    }

    targetFolder.item.push(postmanItem);
  }
}

// Write the collection JSON file
console.log(`Writing Postman collection to: ${postmanPath}`);
fs.writeFileSync(postmanPath, JSON.stringify(collection, null, 2), 'utf8');

console.log('✅ DMS_Postman_Collection.json generated successfully!');
console.log(`Total folders: ${collection.item.length}`);
console.log(`Total requests: ${collection.item.reduce((acc, f) => acc + (f.item ? f.item.length : 1), 0)}`);
