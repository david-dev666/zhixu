export interface QuizOption {
    text: string;
    correct: boolean;
}
export interface QuizQuestion {
    id: string;
    type: 'single' | 'multiple';
    question: string;
    options: QuizOption[];
    explanation: string;
    tags: string[];
    section?: string;
}
export interface PracticeRecord {
    questionId: string;
    correct: boolean;
    at: number;
}
