import type { Q10Option, Q10Question } from './types';

export const sharedActionScale: Q10Option[] = [
  { value: 1, label: 'Do not show reminders for this category' },
  {
    value: 2,
    label: 'Show reminders only when identifying or sensitive details are exposed',
  },
  { value: 3, label: 'Show reminders whenever this verified category is present' },
];

const sharedPrompt =
  'When this type of information appears in an egocentric image or video, when should the assistant show a privacy reminder?';

export const q10Questions: Q10Question[] = [
  {
    id: 'Q1',
    title: 'Biometric data',
    prompt: sharedPrompt,
    example: 'Faces, fingerprints, and other distinctive body features that may identify a person.',
    categoryId: 'biometric_data',
    policyParameter: 'biometric_data_action',
    options: sharedActionScale,
  },
  {
    id: 'Q2',
    title: 'Children images',
    prompt: sharedPrompt,
    example: 'Children, school events, playgrounds, and child-related activities.',
    categoryId: 'children_images',
    policyParameter: 'children_images_action',
    options: sharedActionScale,
  },
  {
    id: 'Q3',
    title: 'Personally identifiable information (PII)',
    prompt: sharedPrompt,
    example:
      'Financial or medical data; names, passports, email addresses, phone numbers, GPS, license plates, and other identifiers.',
    categoryId: 'pii',
    policyParameter: 'pii_action',
    options: sharedActionScale,
  },
  {
    id: 'Q4',
    title: 'Legal sensitivity information',
    prompt: sharedPrompt,
    example:
      'Nudity or explicit imagery; violent or unlawful acts; criminal acts; weapons or other high-risk items.',
    categoryId: 'legal_sensitivity_information',
    policyParameter: 'legal_sensitivity_action',
    options: sharedActionScale,
  },
  {
    id: 'Q5',
    title: 'Personal life',
    prompt: sharedPrompt,
    example:
      'Home interiors, personal items, location context, landmarks, routines, relationships, and activities.',
    categoryId: 'personal_life',
    policyParameter: 'personal_life_action',
    options: sharedActionScale,
  },
  {
    id: 'Q6',
    title: 'Background individuals',
    prompt: sharedPrompt,
    example:
      'Passersby, bystanders, coworkers, patients, patrons, and other people incidentally captured.',
    categoryId: 'background_individuals',
    policyParameter: 'background_individuals_action',
    options: sharedActionScale,
  },
  {
    id: 'Q7',
    title: 'Inferred risks',
    prompt:
      'When a visual cue supports a sensitive inference, should the assistant show a brief privacy reminder?',
    policyParameter: 'inference_reminder_level',
    options: [
      { value: 1, label: 'Do not show a privacy reminder' },
      { value: 3, label: 'Show a brief privacy reminder' },
    ],
  },
  {
    id: 'Q8',
    title: 'Other verified privacy categories',
    prompt:
      'If experts verify a privacy category that was not covered above, when should the assistant show a reminder?',
    policyParameter: 'unlisted_category_trigger',
    options: sharedActionScale,
  },
  {
    id: 'Q9',
    title: 'Uncertainty',
    prompt:
      'When the assistant is unsure whether a cue is privacy-sensitive, should it show a brief privacy reminder?',
    policyParameter: 'uncertain_risk_action',
    options: [
      { value: 1, label: 'Do not show a privacy reminder' },
      { value: 3, label: 'Show a brief privacy reminder' },
    ],
  },
  {
    id: 'Q10',
    title: 'Task relevance',
    prompt:
      'When privacy-sensitive content is visible but not needed for the current task, should the assistant show a brief privacy reminder?',
    policyParameter: 'task_irrelevant_action',
    options: [
      { value: 1, label: 'Do not show a privacy reminder' },
      { value: 3, label: 'Show a brief privacy reminder' },
    ],
  },
];

export const profileConfirmationOptions = [
  { value: 'matches', label: 'Yes, it generally matches.' },
  { value: 'too_many', label: 'It would produce too many reminders.' },
  { value: 'not_enough', label: 'It would not provide enough protection.' },
  { value: 'context_dependent', label: 'Some preferences depend more strongly on context.' },
];

export const probeQuestionPrompts = {
  awareness: 'Before the highlight, how had you noticed this visual content?',
  action: 'When should the assistant show a privacy reminder for similar visual content?',
} as const;

export const heldOutAcceptanceQuestions = {
  acceptance: {
    id: 'reminder_decision_acceptance',
    prompt: "How acceptable was the assistant's reminder decision for this video?",
    options: [
      { value: 1, label: 'Not at all acceptable' },
      { value: 2, label: 'Slightly acceptable' },
      { value: 3, label: 'Moderately acceptable' },
      { value: 4, label: 'Very acceptable' },
      { value: 5, label: 'Completely acceptable' },
    ],
  },
  preferredDecision: {
    id: 'preferred_reminder_decision',
    prompt: 'What should the assistant have done for this video?',
    options: [
      { value: 0, label: 'Do not show a privacy reminder' },
      { value: 1, label: 'Show a brief privacy reminder' },
    ],
  },
} as const;
