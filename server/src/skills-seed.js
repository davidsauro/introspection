// The default DBT skills: DBT Pal's 26 plus 6 more from the standard skills manual, in the
// app's four modules. None are starred to begin with; she picks the ones for the Day screen
// in Settings. Descriptions are our own wording and can be edited in Settings.
export const MODULES = ['mindfulness', 'distress', 'emotion', 'interpersonal'];

export const DEFAULT_SKILLS = {
  mindfulness: [
    ['Wise Mind', 'Find the middle ground between emotion and logic, and act from there.'],
    ['Observe', 'Notice sensations, thoughts and feelings without trying to change them.'],
    ['Describe', 'Put what you notice into plain, factual words.'],
    ['Participate', "Throw yourself fully into what you're doing, without self-consciousness."],
    ['Nonjudgmental stance', 'Take things as they are, without labelling them good or bad.'],
    ['One-mindfully', 'Do one thing at a time, and gently bring your attention back when it wanders.'],
    ['Effectiveness', 'Do what works toward your goal, not what feels fair or right in the moment.'],
  ],
  distress: [
    ['STOP', 'Stop, step back, observe, then proceed mindfully before acting on an urge.'],
    ['TIPP', 'Calm your body fast: cold water, intense exercise, paced breathing, muscle relaxation.'],
    ['Pros and cons', 'Weigh acting on an urge against riding it out.'],
    [
      'Distract with ACCEPTS',
      'Shift your attention until the wave passes: activities, helping others, comparisons, other emotions, pushing away, other thoughts, sensations.',
    ],
    ['Self-soothe', 'Comfort yourself through sight, sound, smell, taste and touch.'],
    [
      'IMPROVE the moment',
      'Make a hard moment more bearable: imagery, meaning, prayer, relaxation, one thing at a time, a short break, encouragement.',
    ],
    ['Cheerleading statements', 'Talk to yourself with short, kind, specific encouragement.'],
    ['Radical acceptance', "Fully accept what you can't change, so you can stop fighting reality."],
    ['Turning the mind', 'Choose acceptance again each time you notice yourself pushing reality away.'],
    ['Willingness', 'Do what the situation needs, even when part of you resists.'],
    ['Half-smile and willing hands', 'Soften your face and open your hands to ease resistance.'],
  ],
  emotion: [
    ['Check the Facts', 'Ask whether the emotion, and how strong it is, fits the facts.'],
    ['Opposite Action', "When an emotion doesn't fit the facts, act opposite to its urge."],
    ['Problem Solving', 'When an emotion does fit the facts, work out how to change the situation.'],
    ['Accumulate Positive Experiences', 'Add pleasant moments now, and build toward a life you value.'],
    ['Build Mastery', 'Do one thing each day that makes you feel capable.'],
    ['Cope Ahead', "Plan and rehearse how you'll handle a hard situation before it happens."],
    ['PLEASE', 'Lower your vulnerability: treat illness, eat and sleep well, avoid mood-altering substances, exercise.'],
    ['Mindfulness of current emotion', 'Let the emotion rise and fall like a wave, without pushing it away or acting on it.'],
  ],
  interpersonal: [
    [
      'DEAR MAN',
      'Ask for what you want, or say no, clearly: describe, express, assert, reinforce, stay mindful, appear confident, negotiate.',
    ],
    ['GIVE', 'Protect the relationship: be gentle, interested, validating and easy-going.'],
    ['FAST', 'Keep your self-respect: be fair, skip needless apologies, stick to your values, be truthful.'],
    ['Validation', "Recognise your own or someone else's feelings as understandable."],
    ['Dialectics', 'Hold two opposite truths at once, and look for the middle path.'],
    ['Reinforcement', 'Change habits by rewarding small steps rather than punishing setbacks.'],
  ],
};
