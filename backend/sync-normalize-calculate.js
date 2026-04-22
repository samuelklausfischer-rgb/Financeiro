const fs = require('fs');
const path = require('path');

const root = __dirname;
const calculatorPath = path.join(root, 'src', 'n8n', 'lib', 'calculator.js');
const normalizerPath = path.join(root, 'src', 'n8n', 'lib', 'normalizer.js');
const tailPath = path.join(root, 'src', 'n8n', 'lib', 'n8n-normalize-calculate-tail.js');
const workflowPath = path.join(root, 'src', 'n8n', 'workflows', 'WF-PRN-MAIN-v4.json');

let calculator = fs.readFileSync(calculatorPath, 'utf8');
calculator = calculator.replace(/const \{[\s\S]*?\} = require\('\.\/normalizer'\);\r?\n\r?\n/, '');
calculator = calculator.replace(/module\.exports = \{[\s\S]*?\};\s*$/, '');

const executionWrapper = `
const item = $input.first().json || {};
const context = item.context || {};
const rawData = item.rawData || {};

try {
  const normalizedData = normalizeData(rawData);
  const financials = calculateFinancials(normalizedData);

  return [{
    json: {
      processingValid: true,
      context,
      normalizedData,
      financials,
    },
  }];
} catch (error) {
  return [{
    json: {
      processingValid: false,
      requestId: context.requestId || '',
      errorCode: 'NORMALIZE_CALCULATE_ERROR',
      error: 'Falha ao normalizar e calcular os dados financeiros.',
      details: {
        message: error?.message || String(error),
      },
    },
  }];
}
`;

const tail = `${calculator.trimEnd()}${executionWrapper}`;
fs.writeFileSync(tailPath, tail);

let normalizer = fs.readFileSync(normalizerPath, 'utf8');
normalizer = normalizer.replace(
  /\n\/\/ =============================================================================\n\/\/ Exports\n\/\/ =============================================================================[\s\S]*$/,
  '\n',
);

const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const node = workflow.nodes.find((entry) => entry.name === 'Code: Normalize + Calculate');

if (!node) {
  throw new Error('Node "Code: Normalize + Calculate" not found.');
}

node.parameters.jsCode = `${normalizer.trimEnd()}\n\n${tail.trim()}\n`;

fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
console.log('Tail helper and workflow synchronized.');
