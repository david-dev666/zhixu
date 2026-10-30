import policy from './bank-policy.json';
import type { QuizQuestion } from './types';
export const bankPolicy = policy;
const forbiddenHardware = new RegExp(policy.hardwareForbiddenPatterns.join('|'), 'i');
export function generationGuidance(topic: string): string {
    return `出题对象：${policy.audience}。` + (topic === '硬件' ? policy.hardwareScope : '以算法开发和软件工程实践为背景。');
}
export function supportsHardwareScope(q: QuizQuestion, topic: string): boolean {
    return topic !== '硬件' || !forbiddenHardware.test([q.question, q.explanation, ...q.options.map(o => o.text)].join('\n'));
}
export function isCurrentExtra(q: QuizQuestion): boolean {
    return !q.tags.includes('硬件') || q.policyVersion === policy.hardwareRevision;
}
