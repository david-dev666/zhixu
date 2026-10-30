import type { QuizQuestion } from './types';
export const topics = [
    { id: 'os', name: '操作系统', en: 'OPERATING SYSTEMS', symbol: '⌘', color: '#E4EBE5', description: '进程、内存与系统的底层秩序' },
    { id: 'network', name: '计算机网络', en: 'COMPUTER NETWORKS', symbol: '⇄', color: '#E4EAF2', description: '从一次连接，理解整个网络' },
    { id: 'c', name: 'C', en: 'C LANGUAGE', symbol: 'C', color: '#EEE8E0', description: '指针与内存，贴近机器思考' },
    { id: 'python', name: 'Python', en: 'PYTHON', symbol: 'Py', color: '#F3EDCF', description: '从语言机制到工程实践' },
    { id: 'agent', name: 'Agent', en: 'INTELLIGENT AGENTS', symbol: '✳', color: '#EEE3EA', description: '让模型从回答走向行动' },
    { id: 'harness', name: 'Harness 框架', en: 'AGENT HARNESS', symbol: '⌗', color: '#E2E9E8', description: '工具、上下文与执行循环' },
    { id: 'scheduling', name: 'Agent 项目调度', en: 'ORCHESTRATION', symbol: '⋈', color: '#EAE5F1', description: '把复杂目标拆成可靠的协作' },
    { id: 'llm', name: 'LLM', en: 'LARGE LANGUAGE MODELS', symbol: '≋', color: '#E4E8F5', description: '从注意力到推理与部署' },
    { id: 'hardware', name: '硬件', en: 'COMPUTE HARDWARE', symbol: '▣', color: '#F1E4DA', description: 'CPU、GPU、显存与计算性能' },
];
export function shuffle<T>(items: T[]): T[] { const a = [...items]; for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
} return a; }
export function isCorrect(q: QuizQuestion, selected: number[]) { const correct = q.options.flatMap((o, i) => o.correct ? [i] : []); return selected.length === correct.length && new Set(selected).size === selected.length && selected.every(i => correct.includes(i)); }
export function validQuestion(q: unknown): q is QuizQuestion { if (!q || typeof q !== 'object')
    return false; const x = q as QuizQuestion; if (!['single', 'multiple'].includes(x.type) || typeof x.question !== 'string' || !x.question.trim() || typeof x.explanation !== 'string' || !x.explanation.trim() || !Array.isArray(x.options) || x.options.length < 4 || x.options.length > 6)
    return false; if (!x.options.every(o => typeof o?.text === 'string' && o.text.trim() && typeof o.correct === 'boolean') || new Set(x.options.map(o => o.text.trim())).size !== x.options.length)
    return false; const n = x.options.filter(o => o.correct).length; return x.type === 'single' ? n === 1 : n >= 2 && n < x.options.length; }
