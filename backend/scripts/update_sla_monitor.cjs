const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../services/slaMonitorService.js');
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(
  /WHERE escalation_due_date < NOW\(\)\s+AND status IN \('open', 'assigned'\)/g,
  "WHERE escalation_due_date < NOW()\r\n        AND status IN ('open', 'assigned', 'in_progress')"
);

code = code.replace(
  /WHERE escalation_due_date BETWEEN NOW\(\) AND DATE_ADD\(NOW\(\), INTERVAL 2 HOUR\)\s+AND status IN \('open', 'assigned'\)/g,
  "WHERE escalation_due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR)\r\n        AND status IN ('open', 'assigned', 'in_progress')"
);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Updated in_progress status for escalation SLA');
