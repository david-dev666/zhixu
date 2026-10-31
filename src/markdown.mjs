import MarkdownIt from 'markdown-it';
import cjkFriendly from 'markdown-it-cjk-friendly';

export const answerMarkdown = new MarkdownIt({html:false,breaks:true,linkify:true,typographer:false}).use(cjkFriendly);
// Accept the spaced emphasis occasionally returned by the tutor, without touching code or escapes.
answerMarkdown.inline.ruler.before('emphasis','spaced_strong',(state,silent)=>{
 const rest=state.src.slice(state.pos);
 const match=/^\*\*([ \t]+[^\n]+?)\*\*(?!\*)/.exec(rest);
 if(!match||!match[1].trim()||match[1].includes('**'))return false;
 if(!silent){state.push('strong_open','strong',1);const tokens=answerMarkdown.parseInline(match[1].trim(),state.env)[0].children||[];state.tokens.push(...tokens);state.push('strong_close','strong',-1);}
 state.pos+=match[0].length;return true;
});
export function isWebLink(url){return /^https?:\/\//i.test(url);}
