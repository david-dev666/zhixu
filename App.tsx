import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { questions } from './src/bank';
import { EMBEDDED_API_KEY } from './src/embeddedKey';
import { QuestionTutor } from './src/QuestionTutor';
import { useAndroidBack, type AppPage } from './src/useAndroidBack';
import { isCorrect, shuffle, topics, validQuestion } from './src/domain';
import type { PracticeRecord, QuizQuestion } from './src/types';
type Page = AppPage;
const STORE = 'zhixu.practice.v2';
const EXTRAS = 'zhixu.extra.v2';
const KEY = 'zhixu.key.v2';
function Action({ title, onPress, secondary = false, disabled = false }: {
    title: string;
    onPress: () => void;
    secondary?: boolean;
    disabled?: boolean;
}) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.action, secondary && s.secondary, disabled && s.disabled, pressed && { opacity: 0.8 }]}><Text style={[s.actionText, secondary && { color: '#252D2B' }]}>{title}</Text><Text style={[s.actionText, secondary && { color: '#252D2B' }]}>↗</Text></Pressable>; }
function AppContent() {
    const { width } = useWindowDimensions();
    const desktop = width >= 1000;
    const columns = width >= 800 ? 3 : width >= 540 ? 2 : 1;
    const [page, setPage] = useState<Page>('home');
    const [topic, setTopic] = useState('全部');
    const [bank, setBank] = useState<QuizQuestion[]>(questions);
    const [records, setRecords] = useState<PracticeRecord[]>([]);
    const [ready, setReady] = useState(false);
    const [batch, setBatch] = useState<QuizQuestion[]>([]);
    const [index, setIndex] = useState(0);
    const [selected, setSelected] = useState<number[]>([]);
    const [answered, setAnswered] = useState(false);
    const [score, setScore] = useState(0);
    const [reviewSession, setReviewSession] = useState(false);
    const [key, setKey] = useState(EMBEDDED_API_KEY);
    const [connected, setConnected] = useState(false);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const scroll = useRef<ScrollView>(null);
    const flight = useRef(false);
    useEffect(() => { let alive = true; (async () => { try {
        const [saved, extra, savedKey] = await Promise.all([AsyncStorage.getItem(STORE), AsyncStorage.getItem(EXTRAS), AsyncStorage.getItem(KEY)]);
        if (!alive)
            return;
        if (saved) {
            const list = JSON.parse(saved);
            if (Array.isArray(list))
                setRecords(list.filter(r => typeof r?.questionId === 'string' && typeof r.correct === 'boolean' && typeof r.at === 'number'));
        }
        if (extra) {
            const list = JSON.parse(extra);
            if (Array.isArray(list))
                setBank([...questions, ...list.filter(q => validQuestion(q) && typeof q.id === 'string' && Array.isArray(q.tags) && q.tags.every((t: unknown) => typeof t === 'string'))]);
        }
        if (savedKey)
            setKey(savedKey);
    }
    catch {
        if (alive)
            setNotice('本地记录读取失败，当前使用内置题库。');
    }
    finally {
        if (alive)
            setReady(true);
    } })(); return () => { alive = false; }; }, []);
    useEffect(() => { if (Platform.OS === 'web')
        fetch('http://127.0.0.1:8082/status', { signal: AbortSignal.timeout(4000) }).then(r => r.json()).then(x => setConnected(x.configured === true)).catch(() => setConnected(false)); }, [page]);
    useEffect(() => { if (ready)
        AsyncStorage.setItem(STORE, JSON.stringify(records)).catch(() => setNotice('练习记录保存失败，请检查设备存储。')); }, [records, ready]);
    const navigate = useCallback((p: Page) => { setPage(p); setNotice(''); scroll.current?.scrollTo({ y: 0, animated: false }); }, []);
    useAndroidBack(page, navigate);
    const latest = new Map<string, boolean>();
    records.forEach(r => latest.set(r.questionId, r.correct));
    const wrong = bank.filter(q => latest.get(q.id) === false);
    const studied = new Set(records.map(r => r.questionId)).size;
    const accuracy = records.length ? Math.round(records.filter(r => r.correct).length / records.length * 100) : 0;
    const start = (name: string, review = false) => { const pool = review ? wrong : name === '全部' ? bank : bank.filter(q => q.tags.includes(name)); if (!pool.length) {
        setNotice(review ? '错题已全部巩固，回到知识领域继续探索。' : '这个领域还没有题目，请到设置中更新题库。');
        return;
    } setTopic(name); setBatch(shuffle(pool).slice(0, 10)); setIndex(0); setSelected([]); setAnswered(false); setScore(0); setReviewSession(review); navigate('quiz'); };
    const q = batch[index];
    const complete = page === 'quiz' && index >= batch.length;
    const submit = () => { if (answered || !selected.length || !q)
        return; const correct = isCorrect(q, selected); setAnswered(true); if (correct)
        setScore(v => v + 1); setRecords(prev => [...prev, { questionId: q.id, correct, at: Date.now() }]); };
    const next = () => { setIndex(v => v + 1); setSelected([]); setAnswered(false); scroll.current?.scrollTo({ y: 0, animated: true }); };
    const updateBank = async () => {
        if (flight.current)
            return;
        if (topic === '全部') {
            setNotice('请先选择一个要更新的领域。');
            return;
        }
        if (Platform.OS !== 'web' && !key.trim()) {
            setNotice('请先保存 DeepSeek API Key。');
            return;
        }
        flight.current = true;
        setBusy(true);
        setNotice('正在生成 10 道新题，通常需要几十秒…');
        try {
            let raw: unknown;
            if (Platform.OS === 'web') {
                const response = await fetch('http://127.0.0.1:8082/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic }), signal: AbortSignal.timeout(185000) });
                const data = await response.json();
                if (!response.ok)
                    throw Error(data.error || '更新失败');
                raw = data.questions;
            }
            else {
                const res = await fetch('https://api.deepseek.com/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key.trim()}` }, signal: AbortSignal.timeout(180000), body: JSON.stringify({ model: 'deepseek-flash', thinking: { type: 'disabled' }, max_tokens: 8192, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: '输出中文 JSON：{"questions":[{"type":"single","question":"题干","options":[{"text":"选项","correct":true}],"explanation":"解析"}]}。生成10道有深度的选择题，每题4个选项，单选只有1个正确项，多选有2到3个正确项。答案准确、无歧义。' }, { role: 'user', content: `主题：${topic}` }] }) });
                if (!res.ok)
                    throw Error(`DeepSeek 请求失败（${res.status}）`);
                const data = await res.json();
                if (data.choices?.[0]?.finish_reason !== 'stop')
                    throw Error('生成未完整结束，请重试');
                raw = JSON.parse(data.choices[0].message.content).questions;
            }
            if (!Array.isArray(raw))
                throw Error('题目格式不正确');
            const existing = new Set(bank.map(x => x.question.trim()));
            const added = raw.filter(validQuestion).filter(x => { if (existing.has(x.question.trim()))
                return false; existing.add(x.question.trim()); return true; }).map((x, i) => ({ ...x, id: `extra-${Date.now()}-${i}`, tags: [topic] }));
            if (!added.length)
                throw Error('没有通过校验的新题，请重试');
            const extras = [...bank.slice(questions.length), ...added];
            await AsyncStorage.setItem(EXTRAS, JSON.stringify(extras));
            setBank([...questions, ...extras]);
            setNotice(`已加入 ${added.length} 道新题，随时可以开始练习。`);
        }
        catch (e) {
            setNotice(e instanceof Error ? e.message : '更新失败，请检查网络。');
        }
        finally {
            setBusy(false);
            flight.current = false;
        }
    };
    const saveKey = async () => { try {
        await AsyncStorage.setItem(KEY, key.trim());
        setNotice('API Key 已保存在这台设备。');
    }
    catch {
        setNotice('保存失败，请重试。');
    } };
    const navItems: [
        Page,
        string,
        string
    ][] = [['home', '知识领域', '▦'], ['review', '错题回顾', '↺'], ['settings', '题库设置', '⚙']];
    return <SafeAreaView style={s.safe}><View style={s.app}>
 {desktop && <View style={s.sidebar}><View><View style={{flexDirection:'row',alignItems:'center',gap:10}}><Image source={require('./assets/icon.png')} style={{width:44,height:44,borderRadius:12}}/><Text style={s.brand}>知序<Text style={s.brandDot}>.</Text></Text></View><Text style={s.brandSub}>KNOWLEDGE, IN PRACTICE</Text></View><View style={s.nav}>{navItems.map(([id, label, icon]) => <Pressable key={id} accessibilityRole="button" onPress={() => navigate(id)} style={[s.navItem, (page === id || (id === 'home' && page === 'quiz')) && s.navActive]}><Text style={s.navIcon}>{icon}</Text><Text style={s.navLabel}>{label}</Text>{id === 'review' && wrong.length > 0 && <Text style={s.navCount}>{wrong.length}</Text>}</Pressable>)}</View><View style={s.sideBottom}><View style={s.sideLine}/><Text style={s.sideQuote}>理解，比记住答案更重要。</Text><Text style={s.small}>每天一点，让知识有序生长。</Text></View></View>}
 <View style={s.main}><ScrollView ref={scroll} contentContainerStyle={[s.scroll, desktop && s.scrollDesktop]} keyboardShouldPersistTaps="handled"><View style={s.container}>
 <View style={s.topbar}><View style={{flexDirection:'row',alignItems:'center',gap:10}}>{!desktop && <Image source={require('./assets/icon.png')} style={{width:34,height:34,borderRadius:10}}/>}<Text style={s.breadcrumb}>{desktop ? '个人学习空间' : '知序.'}　/　{page === 'quiz' ? '专注练习' : page === 'review' ? '错题回顾' : page === 'settings' ? '题库设置' : '知识领域'}</Text></View><View style={s.localBadge}><View style={s.dot}/><Text style={s.small}>本地优先 · 自由练习</Text></View></View>
 {!!notice && <View accessibilityRole="alert" style={s.notice}><Text style={s.body}>{notice}</Text></View>}
 {!ready ? <ActivityIndicator color="#283C34" style={{ marginTop: 100 }}/> : page === 'home' ? <>
 <View style={s.pageHeading}><View>{desktop && <Text style={s.eyebrow}>A LITTLE PROGRESS, EVERY DAY</Text>}<Text style={s.pageTitle}>{desktop ? '让每一次练习，' : '让每一次练习，\n'}<Text style={s.titleSoft}>都有收获。</Text></Text><Text style={s.subtitle}>九个技术领域，从理解一个知识点开始。</Text></View></View>
 <View style={[s.hero, !desktop && {padding:24}]}><View pointerEvents="none" accessible={false} style={s.heroDecorOne}/><View pointerEvents="none" accessible={false} style={s.heroDecorTwo}/><View style={{ maxWidth: 520 }}><Text style={s.heroEyebrow}>{desktop?'TODAY’S PRACTICE　/　今日练习':'今日练习'}</Text><Text style={s.heroTitle}>{desktop?'保持好奇。':'保持好奇。\n'}<Text style={{ color: '#D9E5AD' }}>不断进阶。</Text></Text><Text style={s.heroBody}>随机挑选 10 道题，在熟悉与未知之间，拓宽你的技术边界。</Text><Pressable accessibilityRole="button" onPress={() => start('全部')} style={s.heroButton}><Text style={s.heroButtonText}>开始混合练习</Text><Text style={s.heroButtonText}>↗</Text></Pressable></View><View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.heroMark}><Text style={s.heroMarkText}>✳</Text></View></View>
 <View style={s.stats}>{[['题库总量', bank.length.toLocaleString(), '道练习题目'], ['已练习', studied.toLocaleString(), '个知识切片'], ['正确率', `${accuracy}%`, '累计答题表现']].map(([label, value, caption], i) => <View key={label} style={[s.stat, i < 2 && s.statBorder]}><Text style={s.small}>{label}</Text><Text style={s.statNumber}>{value}</Text><Text style={s.statCaption}>{caption}</Text></View>)}</View>
 <View style={s.sectionHeading}><Text style={s.sectionTitle}>探索知识领域</Text><Text style={s.small}>09 个领域 · 按你的节奏</Text></View>
 <View style={s.grid}>{topics.map((t, i) => { const list = bank.filter(q => q.tags.includes(t.name)); const done = list.filter(q => latest.has(q.id)).length; return <Pressable key={t.id} accessibilityRole="button" onPress={() => start(t.name)} style={({ hovered, pressed }: {
            hovered?: boolean;
            pressed: boolean;
        }) => [s.topicCard, { width: columns === 3 ? '31.9%' : columns === 2 ? '48.6%' : '100%' }, hovered && s.topicHover, pressed && { opacity: 0.8 }]}><View style={s.cardTop}><View style={[s.topicIcon, { backgroundColor: t.color }]}><Text style={s.topicSymbol}>{t.symbol}</Text></View><Text style={s.cardNumber}>0{i + 1}　↗</Text></View>{desktop && <Text style={s.cardEyebrow}>{t.en}</Text>}<Text style={s.cardTitle}>{t.name}</Text><Text style={s.cardDescription}>{t.description}</Text><View style={s.cardFooter}><Text style={s.small}>{list.length} 道题</Text><Text style={s.small}>{done ? `已探索 ${done} 道` : '开始探索'}</Text></View><View style={s.cardTrack}><View style={[s.cardProgress, { width: `${list.length ? done / list.length * 100 : 0}%` }]}/></View></Pressable>; })}</View>
 <Text style={s.footer}>不必一次学会所有。今天，比昨天多懂一点就好。</Text>
 </> : page === 'quiz' ? <>
 <Pressable accessibilityRole="button" onPress={() => navigate('home')}><Text style={s.back}>←　返回知识领域</Text></Pressable>
 {complete ? <View style={s.result}><View style={s.resultSymbol}><Text style={{ fontSize: 40, color: '#344C3D' }}>✳</Text></View><Text style={s.eyebrow}>PRACTICE COMPLETED</Text><Text style={s.pageTitle}>又向前了一步。</Text><Text style={s.resultScore}>{score}<Text style={s.resultTotal}> / {batch.length}</Text></Text><Text style={s.subtitle}>每一道想明白的题，都是你的积累。</Text><View style={s.resultActions}><Action title="再练一组" onPress={() => start(topic, reviewSession)}/><Action secondary title="回到知识领域" onPress={() => navigate('home')}/></View></View> : q && <View style={s.quizWrap}><View style={s.quizHeader}><Text style={s.eyebrow}>{reviewSession ? '错题练习' : topic === '全部' ? '混合练习' : topic}</Text><Text style={s.small}>QUESTION　{String(index + 1).padStart(2, '0')} / {batch.length}</Text></View><View style={s.progressTrack}><View style={[s.progress, { width: `${index / batch.length * 100}%` }]}/></View><View style={[s.questionCard,!desktop && {padding:18}]}><View style={s.questionMeta}><Text style={s.typeBadge}>{q.type === 'single' ? '单项选择' : '多项选择'}</Text><Text style={s.small}>{q.tags[0]}{q.section ? ` / ${q.section}` : ''}</Text></View><Text style={s.question}>{q.question}</Text><Text style={s.questionHint}>{q.type === 'single' ? '选择一个最合适的答案' : '选择所有正确答案'}</Text><View style={{ gap: 12 }}>{q.options.map((o, i) => { const chosen = selected.includes(i); const correct = answered && o.correct; const incorrect = answered && chosen && !o.correct; return <Pressable accessibilityRole={q.type === 'single' ? 'radio' : 'checkbox'} accessibilityState={{ checked: chosen, disabled: answered }} key={i} disabled={answered} onPress={() => setSelected(q.type === 'single' ? [i] : chosen ? selected.filter(x => x !== i) : [...selected, i])} style={({ hovered }: {
            hovered?: boolean;
            pressed: boolean;
        }) => [s.option, hovered && !answered && s.optionHover, chosen && s.optionSelected, correct && s.optionCorrect, incorrect && s.optionWrong]}><Text style={[s.optionLetter, chosen && s.optionLetterSelected, correct && s.letterCorrect, incorrect && s.letterWrong]}>{String.fromCharCode(65 + i)}</Text><Text style={[s.optionText,chosen && s.optionTextSelected]}>{o.text}</Text><View pointerEvents="none" accessible={false} style={[s.selectionIndicator,{borderRadius:q.type==='single'?12:6},chosen && s.indicatorSelected,correct && s.indicatorCorrect,incorrect && s.indicatorWrong]}><Text style={s.indicatorMark}>{answered?(correct?'✓':incorrect?'×':''):(chosen?'✓':'')}</Text></View></Pressable>; })}</View>{answered && <View style={[s.explanation, !isCorrect(q, selected) && { backgroundColor: '#FCF1E9' }]}><Text style={s.explanationTitle}>{isCorrect(q, selected) ? '✓　回答正确' : '↺　再理解一下'}</Text><Text style={s.answerLine}>正确答案　{q.options.flatMap((o, i) => o.correct ? [String.fromCharCode(65 + i)] : []).join('、')}</Text><Text style={s.explanationText}>{q.explanation}</Text></View>}<View style={[s.questionActions,!desktop && {flexDirection:'column',alignItems:'stretch'}]}><Text style={s.small}>{answered ? '理解解析，再继续前进' : '慢慢思考，不用计时'}</Text><View style={{minWidth:180,...(!desktop?{width:'100%' as const}:{})}}><Action title={answered ? (index === batch.length - 1 ? '查看成绩' : '下一道题') : '确认答案'} disabled={!answered && !selected.length} onPress={answered ? next : submit}/></View></View><QuestionTutor key={q.id} question={q} selected={selected} answered={answered} apiKey={key}/></View></View>}
 </> : page === 'review' ? <><Text style={s.eyebrow}>LEARN FROM EVERY MISTAKE</Text><Text style={s.pageTitle}>错过的，再理解一遍。</Text><Text style={s.subtitle}>最近一次答错的题目会留在这里，答对后自动移出。</Text><View style={s.reviewSummary}><Text style={s.statNumber}>{wrong.length}<Text style={s.small}> 道待巩固</Text></Text><View style={{ width: 190 }}><Action title="开始错题练习" disabled={!wrong.length} onPress={() => start('全部', true)}/></View></View>{wrong.length === 0 ? <View style={s.empty}><Text style={s.emptySymbol}>✳</Text><Text style={s.sectionTitle}>这里很干净。</Text><Text style={s.subtitle}>开始一组练习，把理解变成积累。</Text><Action title="去练习" onPress={() => navigate('home')}/></View> : wrong.map(q => <View key={q.id} style={s.reviewCard}><Text style={s.eyebrow}>{q.tags[0]} · {q.type === 'single' ? '单选' : '多选'}</Text><Text style={s.reviewQuestion}>{q.question}</Text></View>)}</> : <>
 <Text style={s.eyebrow}>YOUR LEARNING WORKSPACE</Text><Text style={s.pageTitle}>为下一次探索，做好准备。</Text><Text style={s.subtitle}>管理题库，持续补充新的知识点。</Text>
 <View style={s.settingsCard}><View style={s.sectionHeading}><Text style={s.sectionTitle}>题库更新</Text><Text style={s.modelBadge}>DeepSeek Flash</Text></View><Text style={s.body}>选择一个领域，每次补充 10 道新题。新题保存在这台设备，原有题目会保留。</Text><View style={s.pills}>{topics.map(t => <Pressable accessibilityRole="button" key={t.id} onPress={() => setTopic(t.name)} style={[s.pill, topic === t.name && s.pillActive]}><Text style={[s.pillText, topic === t.name && { color: 'white' }]}>{t.name}</Text></Pressable>)}</View><View style={s.settingsBottom}><Text style={s.small}>调用会产生 API 费用 · 生成答案建议核对</Text><View style={{minWidth:180,...(!desktop?{width:'100%' as const}:{})}}><Action title={busy ? '生成中…' : '生成新题'} onPress={() => void updateBank()} disabled={busy || topic === '全部' || (Platform.OS === 'web' && !connected)}/></View></View></View>
 <View style={s.settingsCard}><Text style={s.sectionTitle}>连接与隐私</Text>{Platform.OS === 'web' ? <><View style={s.connection}><View style={[s.dot, { backgroundColor: connected ? '#6D8E62' : '#C77849' }]}/><Text style={s.body}>{connected ? '本地服务已连接，API Key 已配置' : '本地服务未连接，请启动 npm run api'}</Text></View><Text style={s.small}>Key 仅由本机服务读取，不写入网页代码或 Git 仓库。</Text></> : <><Text style={s.subtitle}>{EMBEDDED_API_KEY ? '已内置本地 Key，可直接提问，也可以在这里更换。' : '在这台设备配置你的 DeepSeek API Key。'}</Text><TextInput style={s.input} secureTextEntry autoCapitalize="none" autoCorrect={false} value={key} onChangeText={setKey} placeholder="输入 API Key" placeholderTextColor="#8B928B"/><Action title="保存配置" onPress={() => void saveKey()}/><Text style={s.small}>配置保存在本机应用存储中。</Text></>}<View style={s.divider}/><Text style={s.body}>当前题库　{bank.length} 道 · 9 个领域</Text><Text style={[s.small, { marginTop: 8 }]}>模型：deepseek-flash · 最新 Flash 服务</Text></View>
 </>}
 </View></ScrollView>{!desktop && <View style={s.bottomNav}>{navItems.map(([id, label, icon]) => <Pressable accessibilityRole="button" key={id} onPress={() => navigate(id)} style={s.bottomItem}><Text style={[s.bottomIcon, (page === id || (id === 'home' && page === 'quiz')) && { color: '#294D3B' }]}>{icon}</Text><Text style={[s.bottomLabel, page === id && { color: '#294D3B', fontWeight: '700' }]}>{label}</Text></Pressable>)}</View>}</View>
 </View></SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><StatusBar style="dark" /><AppContent /></SafeAreaProvider>; }
const s = StyleSheet.create({
optionTextSelected:{color:'#253F20',fontWeight:'600'}, selectionIndicator:{width:24,height:24,borderWidth:2,borderColor:'#A5B694',backgroundColor:'#F9FCF4',alignItems:'center',justifyContent:'center'}, indicatorSelected:{borderColor:'#3C6438',backgroundColor:'#3C6438'}, indicatorCorrect:{borderColor:'#427B50',backgroundColor:'#427B50'}, indicatorWrong:{borderColor:'#B26B4C',backgroundColor:'#B26B4C'}, indicatorMark:{fontSize:16,lineHeight:20,fontWeight:'700',color:'#FFFFFF'},

    safe: { flex: 1, backgroundColor: '#F6F6F2' }, app: { flex: 1, flexDirection: 'row' }, sidebar: { width: 232, backgroundColor: '#F0F1EB', borderRightWidth: 1, borderRightColor: '#E3E6DD', padding: 28, paddingTop: 42 }, brand: { fontSize: 36, fontWeight: '800', letterSpacing: -2, color: '#24352C' }, brandDot: { color: '#819761' }, brandSub: { fontSize: 14, letterSpacing: 0.6, color: '#899083', marginTop: 8 }, nav: { marginTop: 62, gap: 8 }, navItem: { paddingVertical: 15, paddingHorizontal: 14, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 14 }, navActive: { backgroundColor: '#E0E5D8' }, navIcon: { fontSize: 21, color: '#4F6251' }, navLabel: { fontSize: 17, color: '#3C4A40', fontWeight: '600' }, navCount: { marginLeft: 'auto', fontSize: 14, color: '#526745' }, sideBottom: { marginTop: 'auto' }, sideLine: { height: 1, backgroundColor: '#DDE1D7', marginBottom: 24 }, sideQuote: { fontSize: 16, color: '#60705D', marginBottom: 8 , lineHeight: 25}, small: { fontSize: 15, color: '#63715D', lineHeight: 24}, main: { flex: 1 }, scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 }, scrollDesktop: { paddingHorizontal: 48, paddingTop: 30 }, container: { width: '100%', maxWidth: 1100, alignSelf: 'center' }, topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, gap: 10, flexWrap: 'wrap' }, breadcrumb: { fontSize: 15, color: '#717C6C' , lineHeight: 24}, localBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7E9C66' }, pageHeading: { marginBottom: 28 }, eyebrow: { fontSize: 14, fontWeight: '600', letterSpacing: 1, color: '#647454', marginBottom: 12 , lineHeight: 22}, pageTitle: { fontSize: 30, lineHeight: 44, fontWeight: '700', letterSpacing: -0.8, color: '#27342C' }, titleSoft: { color: '#687B5C'}, subtitle: { fontSize: 18, color: '#65735D', lineHeight: 29, marginTop: 10 }, hero: { backgroundColor: '#263D32', borderRadius: 18, padding: 30, overflow: 'hidden', marginBottom: 20, minHeight: 240 }, heroEyebrow: { fontSize: 14, letterSpacing: 0.7, color: '#BAC8B3', marginBottom: 18 , lineHeight: 22}, heroTitle: { fontSize: 29, lineHeight: 42, fontWeight: '600', color: '#F5F5E9', letterSpacing: -0.5 }, heroBody: { color: '#CDD7C7', fontSize: 18, lineHeight: 29, marginTop: 12, maxWidth: 370 }, heroButton: { backgroundColor: '#DDEAB5', paddingVertical: 16, paddingHorizontal: 18, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', width: 224, marginTop: 24 , minHeight: 54}, heroButtonText: { fontSize: 17, fontWeight: '700', color: '#2C4532' }, heroMark: { position: 'absolute', right: 28, bottom: -32, opacity: 0.12 }, heroMarkText: { fontSize: 180, color: '#B9CB98' }, heroDecorOne: { position: 'absolute', width: 330, height: 330, borderRadius: 165, borderWidth: 1, borderColor: '#3C5142', right: -40, top: -120 }, heroDecorTwo: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: '#3C5142', right: 15, top: -65 }, stats: { flexDirection: 'row', backgroundColor: '#FDFDF9', borderRadius: 14, borderWidth: 1, borderColor: '#E8EAE1', paddingVertical: 23, marginBottom: 40 }, stat: { flex: 1, paddingHorizontal: 10}, statBorder: { borderRightWidth: 1, borderRightColor: '#E9ECE2' }, statNumber: { fontSize: 32, fontWeight: '500', color: '#354833', marginTop: 7, letterSpacing: -1 , lineHeight: 40}, statCaption: { fontSize: 14, color: '#718064', marginTop: 6 , lineHeight: 22}, sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }, sectionTitle: { fontSize: 22, fontWeight: '600', color: '#344231', letterSpacing: -0.3 , lineHeight: 32}, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, topicCard: { padding: 22, backgroundColor: '#FDFDF9', borderRadius: 14, borderWidth: 1, borderColor: '#E6E9DF', minHeight: 230 }, topicHover: { borderColor: '#A9B69B', backgroundColor: '#FFFFFF', transform: [{ translateY: -2 }] }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}, topicIcon: { height: 43, width: 43, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, topicSymbol: { fontSize: 23, fontWeight: '500', color: '#4E5E50' }, cardNumber: { fontSize: 14, color: '#768369', letterSpacing: 1.2 }, cardEyebrow: { fontSize: 14, letterSpacing: 0.6, color: '#718064', marginBottom: 7 , lineHeight: 22}, cardTitle: { fontSize: 24, color: '#344532', fontWeight: '600', marginBottom: 8 , lineHeight: 34}, cardDescription: { fontSize: 18, color: '#637457', lineHeight: 28}, cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}, cardTrack: { height: 2, backgroundColor: '#EDF0E6', marginTop: 11 }, cardProgress: { height: 2, backgroundColor: '#A5B68C' }, footer: { fontSize: 15, color: '#768367', textAlign: 'center', marginTop: 40, marginBottom: 20, letterSpacing: 0, lineHeight: 25}, back: { fontSize: 17, color: '#7F8D76', marginBottom: 28 , lineHeight: 28}, quizWrap: { maxWidth: 820, width: '100%', alignSelf: 'center' }, quizHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, progressTrack: { height: 3, backgroundColor: '#E5E9DE', marginBottom: 25 }, progress: { height: 3, backgroundColor: '#81996A' }, questionCard: { padding: 26, borderRadius: 16, backgroundColor: '#FDFDF9', borderWidth: 1, borderColor: '#E5E8DE' }, questionMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }, typeBadge: { color: '#5D7451', backgroundColor: '#EBF0E3', paddingHorizontal: 10, paddingVertical: 5, fontSize: 15, borderRadius: 5 , lineHeight: 22}, question: { fontSize: 25, lineHeight: 38, fontWeight: '600', color: '#29382C', marginTop: 25 }, questionHint: { fontSize: 16, color: '#748367', marginTop: 10, marginBottom: 22, lineHeight: 26}, option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 14, borderWidth: 2, borderColor: '#CAD6BC', backgroundColor: '#EDF2E5', minHeight: 78}, optionHover: { backgroundColor: '#E5EDD8', borderColor: '#9CB087' }, optionSelected: { borderColor: '#3C6438', backgroundColor: '#DDEBCB', elevation: 2, shadowColor: '#2B4B25', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: {width:0,height:3} }, optionCorrect: { borderColor: '#427B50', backgroundColor: '#DFEFDA' }, optionWrong: { borderColor: '#B26B4C', backgroundColor: '#F8E3D8' }, optionLetter: { width: 34, height: 34, textAlign: 'center', lineHeight: 34, borderRadius: 6, backgroundColor: '#DEE7D0', color: '#637654', fontSize: 16, fontWeight: '600', overflow: 'hidden' }, optionLetterSelected: { backgroundColor: '#496B3D', color: '#fff' }, letterCorrect: { backgroundColor: '#48825A', color: '#fff' }, letterWrong: { backgroundColor: '#B97258', color: '#fff' }, optionText: { flex: 1, fontSize: 18, color: '#4E5C47', lineHeight: 30}, questionActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, gap: 15, flexWrap: 'wrap' }, action: { paddingHorizontal: 20, paddingVertical: 16, borderRadius: 8, backgroundColor: '#304B37', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 , minHeight: 54}, secondary: { backgroundColor: '#EBEEE3' }, actionText: { color: '#F8F9F2', fontSize: 17, fontWeight: '600' , lineHeight: 24}, disabled: { opacity: 0.4 }, explanation: { padding: 22, borderRadius: 10, backgroundColor: '#EDF3E6', marginTop: 25 }, explanationTitle: { fontSize: 19, fontWeight: '600', color: '#4A6440', marginBottom: 14 , lineHeight: 29}, answerLine: { fontSize: 16, color: '#77896B', marginBottom: 10 , lineHeight: 26}, explanationText: { fontSize: 18, color: '#4F6243', lineHeight: 31}, result: { alignItems: 'center', paddingVertical: 45 }, resultSymbol: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#E3ECCF', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }, resultScore: { fontSize: 90, fontWeight: '500', color: '#3C593D', marginTop: 35, letterSpacing: -4 }, resultTotal: { fontSize: 28, color: '#A0AF91', letterSpacing: 0 }, resultActions: { width: '100%', maxWidth: 300, gap: 12, marginTop: 35 }, reviewSummary: { padding: 24, backgroundColor: '#E9EEDF', borderRadius: 14, marginVertical: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }, reviewCard: { padding: 24, borderWidth: 1, borderColor: '#E5E8DE', backgroundColor: '#FDFDF9', borderRadius: 12, marginBottom: 12 }, reviewQuestion: { fontSize: 20, color: '#44553C', lineHeight: 32}, empty: { padding: 40, alignItems: 'center', gap: 12 }, emptySymbol: { fontSize: 64, color: '#9CAF85', marginBottom: 15 }, settingsCard: { padding: 26, backgroundColor: '#FDFDF9', borderWidth: 1, borderColor: '#E4E8DC', borderRadius: 14, marginTop: 25 }, body: { fontSize: 18, color: '#5B6D4D', lineHeight: 29}, modelBadge: { fontSize: 14, color: '#637A52', backgroundColor: '#EAF0DE', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 , lineHeight: 22}, pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginVertical: 25 }, pill: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 7, backgroundColor: '#EFF2E8' , minHeight: 48}, pillActive: { backgroundColor: '#405D36' }, pillText: { fontSize: 17, color: '#647653', lineHeight: 25}, settingsBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }, connection: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 20 }, divider: { height: 1, backgroundColor: '#EBEEE3', marginVertical: 23 }, input: { borderWidth: 1, borderColor: '#DDE4D3', backgroundColor: '#F5F7F0', borderRadius: 8, padding: 15, color: '#405736', marginVertical: 15 , fontSize: 18, lineHeight: 28, minHeight: 56}, notice: { padding: 16, backgroundColor: '#E8EEDB', borderRadius: 10, marginBottom: 24 }, bottomNav: { flexDirection: 'row', paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#E0E6D7', backgroundColor: '#F9FAF4' }, bottomItem: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 9, minHeight: 64}, bottomIcon: { fontSize: 27, color: '#74866B'}, bottomLabel: { fontSize: 15, color: '#637457', lineHeight: 22}
});
