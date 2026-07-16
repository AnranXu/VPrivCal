import type { Q10Option, Q10Question } from './types';

export const sharedActionScale: Q10Option[] = [
  { value: 1, label: 'Use for the current task without interruption' },
  { value: 2, label: 'Handle silently and avoid unnecessary detail' },
  { value: 3, label: 'Give a brief reminder' },
  { value: 4, label: 'Ask before using it' },
  { value: 5, label: 'Do not use it unless explicitly requested' },
];

const sharedPrompt =
  'When this type of information appears in an egocentric image or video, what should the assistant do by default?';

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
      'When a visual cue supports a sensitive inference, should the system ignore it, remind only for likely/serious cases, give a brief reminder, ask first, or avoid the inference unless requested?',
    policyParameter: 'inference_reminder_level',
    options: [
      { value: 1, label: 'Ignore it' },
      { value: 2, label: 'Remind only for likely/serious cases' },
      { value: 3, label: 'Give a brief reminder' },
      { value: 4, label: 'Ask first' },
      { value: 5, label: 'Avoid the inference unless requested' },
    ],
  },
  {
    id: 'Q8',
    title: 'Reminder sensitivity',
    prompt:
      'Should the system show very few reminders, serious/likely reminders only, balance misses and false alarms, show most plausible risks, or show every possible risk?',
    policyParameter: 'reminder_sensitivity',
    options: [
      { value: 1, label: 'Show very few reminders' },
      { value: 2, label: 'Show serious/likely reminders only' },
      { value: 3, label: 'Balance misses and false alarms' },
      { value: 4, label: 'Show most plausible risks' },
      { value: 5, label: 'Show every possible risk' },
    ],
  },
  {
    id: 'Q9',
    title: 'Uncertainty',
    prompt:
      'When sensitivity is uncertain, should the system do nothing, show a quiet indicator, give a brief uncertain reminder, ask first, or avoid using the information until approved?',
    policyParameter: 'uncertain_risk_action',
    options: [
      { value: 1, label: 'Do nothing' },
      { value: 2, label: 'Show a quiet indicator' },
      { value: 3, label: 'Give a brief uncertain reminder' },
      { value: 4, label: 'Ask first' },
      { value: 5, label: 'Avoid using the information until approved' },
    ],
  },
  {
    id: 'Q10',
    title: 'Task relevance',
    prompt:
      'When sensitive content is visible but not needed for the task, should the system do nothing, remind only if serious, show a brief indicator, ask first, or avoid it unless requested?',
    policyParameter: 'task_irrelevant_action',
    options: [
      { value: 1, label: 'Do nothing' },
      { value: 2, label: 'Remind only if serious' },
      { value: 3, label: 'Show a brief indicator' },
      { value: 4, label: 'Ask first' },
      { value: 5, label: 'Avoid it unless requested' },
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
  action: 'What should the assistant do with similar visual content?',
} as const;
