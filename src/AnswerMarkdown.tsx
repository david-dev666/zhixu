import React from 'react';
import {Linking,Platform,ScrollView,StyleSheet,Text,View} from 'react-native';
import Markdown,{type RenderRules} from 'react-native-markdown-display';
import {answerMarkdown,isWebLink} from './markdown.mjs';

const mono=Platform.OS==='ios'?'Menlo':'monospace';
const rules:RenderRules={
 textgroup:(node,children,_parent,styles)=><Text key={node.key} selectable style={styles.textgroup}>{children}</Text>,
 fence:node=><CodeBlock key={node.key} content={node.content}/>,
 code_block:node=><CodeBlock key={node.key} content={node.content}/>,
 table:(node,children)=><ScrollView key={node.key} horizontal nestedScrollEnabled style={s.scroll}><View style={[s.table,{width:Math.max(2,node.children[0]?.children[0]?.children.length||2)*164}]}>{children}</View></ScrollView>,
 th:(node,children)=><View key={node.key} style={[s.cell,s.headerCell]}>{children}</View>,
 td:(node,children)=><View key={node.key} style={s.cell}>{children}</View>,
 image:node=><Text key={node.key} selectable style={s.imageLabel}>{node.attributes.alt||node.content||'图片'}</Text>,
};
function CodeBlock({content}:{content:string}){
 return <ScrollView horizontal nestedScrollEnabled style={s.codeScroll} contentContainerStyle={s.codeContainer}><Text selectable style={s.code}>{content.replace(/\n$/,'')}</Text></ScrollView>;
}
export function AnswerMarkdown({children}:{children:string}){
 return <Markdown markdownit={answerMarkdown} style={markdownStyles} rules={rules} onLinkPress={url=>{if(isWebLink(url))void Linking.openURL(url).catch(()=>{});return false;}}>{children}</Markdown>;
}
const s=StyleSheet.create({
 cell:{width:164,flexShrink:0,padding:10},headerCell:{backgroundColor:'#E2EBD8'},
 scroll:{maxWidth:'100%',marginVertical:10},table:{borderWidth:1,borderColor:'#C9D5BD',borderRadius:6,overflow:'hidden'},
 codeScroll:{maxWidth:'100%',backgroundColor:'#24382F',borderRadius:8,marginVertical:10},codeContainer:{padding:14},code:{fontFamily:mono,fontSize:17,lineHeight:28,color:'#F2F6EB'},imageLabel:{fontSize:18,lineHeight:31,color:'#637457'},
});
const markdownStyles=StyleSheet.create({
 body:{fontSize:18,lineHeight:31,color:'#33482C',flexShrink:1},
 paragraph:{marginTop:4,marginBottom:10},textgroup:{flexShrink:1},
 strong:{fontWeight:'700',color:'#243D2D'},em:{fontStyle:'italic'},
 heading1:{fontSize:24,lineHeight:35,fontWeight:'700',marginTop:16,marginBottom:8},
 heading2:{fontSize:22,lineHeight:33,fontWeight:'700',marginTop:14,marginBottom:8},
 heading3:{fontSize:20,lineHeight:31,fontWeight:'700',marginTop:12,marginBottom:6},
 heading4:{fontSize:19,lineHeight:30,fontWeight:'700',marginTop:10,marginBottom:6},
 heading5:{fontSize:18,lineHeight:30,fontWeight:'700',marginTop:10,marginBottom:6},
 heading6:{fontSize:18,lineHeight:30,fontWeight:'700',marginTop:10,marginBottom:6},
 blockquote:{backgroundColor:'#E6EDDD',borderColor:'#789468',borderLeftWidth:3,marginLeft:0,paddingHorizontal:12,paddingVertical:4,marginVertical:8},
 list_item:{marginVertical:3},bullet_list_icon:{marginLeft:0,marginRight:10},ordered_list_icon:{marginLeft:0,marginRight:9},
 bullet_list_content:{minWidth:0},ordered_list_content:{minWidth:0},
 code_inline:{fontFamily:mono,fontSize:17,lineHeight:29,color:'#385434',backgroundColor:'#E1E8D8',borderWidth:0,padding:0},
 link:{color:'#326947',textDecorationLine:'underline'},
 th:{width:164,flexBasis:164,flexGrow:0,flexShrink:0,padding:10,fontWeight:'700',backgroundColor:'#E2EBD8'},td:{width:164,flexBasis:164,flexGrow:0,flexShrink:0,padding:10},
 tr:{borderColor:'#C9D5BD',borderBottomWidth:1},hr:{height:1,backgroundColor:'#CCD8BF',marginVertical:14},
});
