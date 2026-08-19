export const DEFAULT_MODELS = [
  'gpt-4o-mini',
  'gpt-4.1-mini',
  'claude-3-7-sonnet-latest',
  'deepseek-chat',
  'gemini-2.0-flash',
  'qwen-max',
]

export const PRESET_PROMPTS: { label: string; system: string; prompt: string }[] = [
  {
    label: 'Sanity check',
    system: 'You are a concise assistant.',
    prompt: 'In one sentence, explain what you are and which model family you belong to.',
  },
  {
    label: 'Reasoning',
    system: 'Think step by step, then give the final answer on its own line.',
    prompt:
      'A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?',
  },
  {
    label: 'Coding',
    system: 'You are a senior engineer. Answer with code and a short explanation.',
    prompt:
      'Write a TypeScript function that merges overlapping intervals, with a couple of test cases.',
  },
  {
    label: 'JSON output',
    system: 'Reply with valid JSON only, no markdown fences.',
    prompt:
      'Extract fields from: "Order #A17 for Jane Doe, 3 units of widget-blue, shipped 2026-04-02 to Berlin."',
  },
  {
    label: 'Long context / summarize',
    system: '',
    prompt:
      'Summarize the key trade-offs between transformer attention variants (full, sliding window, linear) in 5 bullets.',
  },
  {
    label: 'Multilingual',
    system: '',
    prompt: '用中文解释什么是"模型蒸馏"，并给出一个生活化的比喻。',
  },
]
