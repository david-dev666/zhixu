import type {QuizQuestion} from './types';
export type TutorMessage = {role:'user'|'assistant';content:string};
export type TutorContext = {question:QuizQuestion;selected?:number[];answered?:boolean;history:TutorMessage[]};
export const TUTOR_MODEL: string;
export function tutorMessages(context:TutorContext): {role:'system'|'user'|'assistant';content:string}[];
export function tutorPayload(context:TutorContext): {model:string;thinking:{type:string};max_tokens:number;messages:ReturnType<typeof tutorMessages>};
