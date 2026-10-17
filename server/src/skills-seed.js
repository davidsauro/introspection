// The default DBT skills: DBT Pal's 26 plus 6 more from the standard skills manual, in the
// app's four modules. `starter` marks the 13 that fill the "Recent" list until she has
// used skills of her own. Descriptions are our own wording and can be edited in Settings.
export const MODULES = ['mindfulness', 'distress', 'emotion', 'interpersonal'];

export const DEFAULT_SKILLS = {
  mindfulness: [
    ['Wise Mind', 'Find the middle ground between emotion and logic, and act from there.', true],
    ['Observe', 'Notice sensations, thoughts and feelings without trying to change them.', true],
    ['Describe', 'Put what you notice into plain, factual words.', true],
    ['Participate', "Throw yourself fully into what you're doing, without self-consciousness.", false],
    ['Nonjudgmental stance', 'Take things as they are, without labelling them good or bad.', true],
    ['One-mindfully', 'Do one thing at a time, and gently bring your attention back when it wanders.', false],
    ['Effectiveness', 'Do what works toward your goal, not what feels fair or right in the moment.', false],
  ],
  distress: [
    ['STOP', 'Stop, step back, observe, then proceed mindfully before acting on an urge.', false],
    ['TIPP', 'Calm your body fast: cold water, intense exercise, paced breathing, muscle relaxation.', false],
    ['Pros and cons', 'Weigh acting on an urge against riding it out.', false],
    [
      'Distract with ACCEPTS',
      'Shift your attention until the wave passes: activities, helping others, comparisons, other emotions, pushing away, other thoughts, sensations.',
      true,
    ],
    ['Self-soothe', 'Comfort yourself through sight, sound, smell, taste and touch.', true],
    [
      'IMPROVE the moment',
      'Make a hard moment more bearable: imagery, meaning, prayer, relaxation, one thing at a time, a short break, encouragement.',
      false,
    ],
    ['Cheerleading statements', 'Talk to yourself with short, kind, specific encouragement.', false],
    ['Radical acceptance', "Fully accept what you can't change, so you can stop fighting reality.", true],
    ['Turning the mind', 'Choose acceptance again each time you notice yourself pushing reality away.', false],
    ['Willingness', 'Do what the situation needs, even when part of you resists.', false],
    ['Half-smile and willing hands', 'Soften your face and open your hands to ease resistance.', false],
  ],
  emotion: [
    ['Check the Facts', 'Ask whether the emotion, and how strong it is, fits the facts.', true],
    ['Opposite Action', "When an emotion doesn't fit the facts, act opposite to its urge.", true],
    ['Problem Solving', 'When an emotion does fit the facts, work out how to change the situation.', false],
    ['Accumulate Positive Experiences', 'Add pleasant moments now, and build toward a life you value.', false],
    ['Build Mastery', 'Do one thing each day that makes you feel capable.', false],
    ['Cope Ahead', "Plan and rehearse how you'll handle a hard situation before it happens.", false],
    ['PLEASE', 'Lower your vulnerability: treat illness, eat and sleep well, avoid mood-altering substances, exercise.', true],
    ['Mindfulness of current emotion', 'Let the emotion rise and fall like a wave, without pushing it away or acting on it.', false],
  ],
  interpersonal: [
    [
      'DEAR MAN',
      'Ask for what you want, or say no, clearly: describe, express, assert, reinforce, stay mindful, appear confident, negotiate.',
      true,
    ],
    ['GIVE', 'Protect the relationship: be gentle, interested, validating and easy-going.', true],
    ['FAST', 'Keep your self-respect: be fair, skip needless apologies, stick to your values, be truthful.', false],
    ['Validation', "Recognise your own or someone else's feelings as understandable.", true],
    ['Dialectics', 'Hold two opposite truths at once, and look for the middle path.', false],
    ['Reinforcement', 'Change habits by rewarding small steps rather than punishing setbacks.', false],
  ],
};
