#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pilotRoot = path.join(repositoryRoot, 'source materials', 'pilot videos');
const defaultDetectionPath = path.join(pilotRoot, 'vlm_detections.json');
const defaultOutputPath = path.join(pilotRoot, 'randomized_policy_robustness.json');
const defaultResponsePath = path.join(pilotRoot, 'randomized_vprivcal_responses.json');
const defaultProfileCount = 500;
const defaultSeed = 20260721;

function usage() {
  return [
    'Usage: node scripts/generate_randomized_profile_report.mjs [detection-json] [output-json] [response-json] [profile-count] [seed]',
    '',
    `Default detection JSON: ${defaultDetectionPath}`,
    `Default output JSON:    ${defaultOutputPath}`,
    `Default response JSON:  ${defaultResponsePath}`,
    `Default profile count:  ${defaultProfileCount}`,
    `Default seed:           ${defaultSeed}`,
  ].join('\n');
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(usage());
  process.exit(0);
}

const detectionPath = path.resolve(process.argv[2] ?? defaultDetectionPath);
const outputPath = path.resolve(process.argv[3] ?? defaultOutputPath);
const responsePath = path.resolve(process.argv[4] ?? defaultResponsePath);
const profileCount = Number(process.argv[5] ?? defaultProfileCount);
const seed = Number(process.argv[6] ?? defaultSeed);
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
  const module = await vite.ssrLoadModule('/src/utils/randomizedProfileSimulation.ts');
  const result = module.runRandomizedProfileSimulation(detectionDocument, dataset, {
    profileCount,
    seed,
  });
  const { profileResults, ...summary } = result;
  const report = {
    ...summary,
    profileResults: profileResults.map(
      ({ profileId, latentReminderProbability, q10Values, decisions, preferenceSignature, effectiveSignature }) => ({
        profileId,
        latentReminderProbability,
        q10Values,
        decisions,
        preferenceSignature,
        effectiveSignature,
      }),
    ),
  };
  const responses = {
    schemaVersion: result.schemaVersion,
    nonEmpirical: true,
    interpretation: result.interpretation,
    config: result.config,
    sourceDetectionJson: detectionPath,
    profiles: profileResults.map(
      ({ profileId, latentReminderProbability, q10Values, response }) => ({
        profileId,
        latentReminderProbability,
        q10Values,
        response,
      }),
    ),
  };

  await Promise.all([
    mkdir(path.dirname(outputPath), { recursive: true }),
    mkdir(path.dirname(responsePath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(responsePath, `${JSON.stringify(responses, null, 2)}\n`, 'utf8'),
  ]);

  const percent = (value) => `${(value * 100).toFixed(1)}%`;
  console.log(`Randomized robustness report: ${outputPath}`);
  console.log(`Randomized VPrivCal responses: ${responsePath}`);
  console.log(
    `${result.robustness.compiledProfileCount}/${result.robustness.requestedProfileCount} profiles compiled; ` +
      `${result.robustness.decisionCount} decisions; ` +
      `${result.robustness.uniquePreferenceSignatures} unique preference signatures.`,
  );
  console.log(
    `Reminder decisions ${percent(result.robustness.reminderDecisionRate)}; ` +
      `safety-floor overrides ${percent(result.robustness.safetyFloorAppliedRate)}.`,
  );
  console.log('These are seeded synthetic robustness checks, not participant findings.');
} finally {
  await vite.close();
}
