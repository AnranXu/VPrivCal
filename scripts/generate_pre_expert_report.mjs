#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pilotRoot = path.join(repositoryRoot, 'source materials', 'pilot videos');
const defaultDetectionPath = path.join(pilotRoot, 'vlm_detections.json');
const defaultOutputPath = path.join(pilotRoot, 'simulated_policy_comparison.json');

function usage() {
  return [
    'Usage: node scripts/generate_pre_expert_report.mjs [detection-json] [output-json] [response-json]',
    '',
    `Default detection JSON: ${defaultDetectionPath}`,
    `Default output JSON:    ${defaultOutputPath}`,
    'Default response JSON:  simulated_vprivcal_responses.json beside the output report',
  ].join('\n');
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(usage());
  process.exit(0);
}

const detectionPath = path.resolve(process.argv[2] ?? defaultDetectionPath);
const outputPath = path.resolve(process.argv[3] ?? defaultOutputPath);
const responseOutputPath = path.resolve(
  process.argv[4] ?? path.join(path.dirname(outputPath), 'simulated_vprivcal_responses.json'),
);
const datasetPath = path.join(repositoryRoot, 'public', 'data', 'vprivcal_detections.json');
const [detectionDocument, dataset] = await Promise.all([
  readFile(detectionPath, 'utf8').then(JSON.parse),
  readFile(datasetPath, 'utf8').then(JSON.parse),
]);

const vite = await createServer({
  root: repositoryRoot,
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
});

try {
  const module = await vite.ssrLoadModule('/src/utils/preExpertSimulation.ts');
  const report = module.runPreExpertSimulation(detectionDocument, dataset);
  const simulatedResponses = {
    schemaVersion: report.schemaVersion,
    nonEmpirical: true,
    interpretation: report.interpretation,
    sourceDetectionJson: detectionPath,
    profiles: report.profileResults.map(({ profileId, label, rationale, response }) => ({
      profileId,
      label,
      rationale,
      response,
    })),
  };
  await Promise.all([
    mkdir(path.dirname(outputPath), { recursive: true }),
    mkdir(path.dirname(responseOutputPath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(responseOutputPath, `${JSON.stringify(simulatedResponses, null, 2)}\n`, 'utf8'),
  ]);

  const metrics = report.aggregateMetrics;
  const percent = (value) => `${(value * 100).toFixed(1)}%`;
  console.log(`Simulation report: ${outputPath}`);
  console.log(`Simulated VPrivCal responses: ${responseOutputPath}`);
  console.log(
    `Exact target-action agreement: no filter ${percent(metrics.nonFilteredBaseline.exactAgreementRate)}, ` +
      `personalized preference ${percent(metrics.personalizedPreference.exactAgreementRate)}, ` +
      `with proof-of-concept floors ${percent(
        metrics.personalizedWithProofOfConceptFloors.exactAgreementRate,
      )}`,
  );
  console.log('These are deterministic simulated-profile checks, not participant findings.');
} finally {
  await vite.close();
}
