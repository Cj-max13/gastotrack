import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Keyboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendChatMessage, getTransactions, getInsights } from '../Services/api';
import GastoAvatar from '../components/GastoAvatar';
const SUGGESTED_QUESTIONS = [
  'How much have I spent this month?',
  'Which category am I overspending on?',
  'Show me my top 5 merchants',
  'Am I within my food budget?',
  'Add: Spent ₱150 at Jollibee',
];

const WELCOME = {
  id: 'welcome',
  role: 'model',
  text: "Hi! I'm Gasto 👋, your personal finance assistant.\n\nI automatically observe your spending and give you real-time advice. You can also ask me anything!\n\nWhat would you like to know?",
};

export default function ChatScreen() {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [talking, setTalking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [token, setToken] = useState(null);
  const listRef = useRef(null);
  const talkTimerRef = useRef(null);
  const hasAnalyzed = useRef(false);

  // Load JWT token on mount
  useEffect(() => {
    AsyncStorage.getItem('token').then(t => setToken(t));
  }, []);

  // ── Auto-analyze spending when screen is focused ──────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!hasAnalyzed.current) {
        hasAnalyzed.current = true;
        autoAnalyze();
      }
    }, [])
  );

  const autoAnalyze = async () => {
    try {
      setAnalyzing(true);
      setThinking(true);

      const txRes = await getTransactions();
      const txList = txRes.data;
      if (!txList || txList.length === 0) return;

      const stored = await AsyncStorage.getItem('budgets');
      const budgets = stored ? JSON.parse(stored) : null;
      const insightsRes = await getInsights(txList, budgets);
      const insights = insightsRes.data;

      // Build a context-rich prompt for Gasto to greet with
      const overCategories = Object.entries(insights.budget_status || {})
        .filter(([, v]) => v.status === 'over')
        .map(([k]) => k);

      const warnCategories = Object.entries(insights.budget_status || {})
        .filter(([, v]) => v.status === 'warning')
        .map(([k]) => k);

      const prompt = `You are observing the user's current spending data:
- Total spent: ₱${insights.total_spent?.toLocaleString()}
- Transactions: ${insights.transaction_count}
- Top category: ${insights.top_category || 'none'}
- Over budget: ${overCategories.join(', ') || 'none'}
- Near limit (80%+): ${warnCategories.join(', ') || 'none'}

Give a short (2–3 sentence) proactive observation and one specific recommendation. 
Be warm and encouraging. Start with a relevant emoji. Don't list numbers back — give advice.`;

      const res = await sendChatMessage(prompt, [], token);
      const autoMsg = {
        id: 'auto-' + Date.now(),
        role: 'model',
        text: res.data.reply,
        isAuto: true,
      };

      setMessages([WELCOME, autoMsg]);
      triggerTalking(res.data.reply);
    } catch {
      // Silent fail — don't disrupt UX if AI or backend is down
    } finally {
      setAnalyzing(false);
      setThinking(false);
    }
  };

  // Make avatar talk for duration proportional to message length
  const triggerTalking = (text) => {
    clearTimeout(talkTimerRef.current);
    setTalking(true);
    const duration = Math.min(Math.max(text.length * 40, 2000), 8000);
    talkTimerRef.current = setTimeout(() => setTalking(false), duration);
  };

  const buildHistory = (msgs) =>
    msgs
      .filter((m) => m.id !== 'welcome' && !m.isAuto)
      .map((m) => ({ role: m.role, parts: [m.text] }));

  const send = useCallback(async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    Keyboard.dismiss();
    setInput('');

    const userMsg = { id: Date.now().toString(), role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setThinking(true);

    try {
      const history = buildHistory([...messages, userMsg]).slice(0, -1);
      const res = await sendChatMessage(trimmed, history, token);
      const botMsg = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: res.data.reply,
        toolCalls: res.data.tool_calls || [],
        steps: res.data.steps || 0,
      };
      setMessages((prev) => [...prev, botMsg]);
      triggerTalking(res.data.reply);
    } catch {
      const errMsg = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Sorry, I couldn't connect to the AI service right now. Make sure it's running on port 8000. 🔌",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setThinking(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, messages, loading]);

  const clearChat = () => {
    setMessages([WELCOME]);
    setTalking(false);
    clearTimeout(talkTimerRef.current);
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}>
        {!isUser && (
          <View style={styles.smallAvatar}>
            <Text style={styles.smallAvatarText}>🤖</Text>
          </View>
        )}
        <View style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleBot,
          item.isAuto && styles.bubbleAuto,
        ]}>
          {item.isAuto && (
            <Text style={styles.autoLabel}>🔍 AUTO-ANALYSIS</Text>
          )}
          {/* Tool calls indicator */}
          {item.toolCalls?.length > 0 && (
            <View style={styles.toolCallsRow}>
              <Text style={styles.toolCallsText}>
                🔧 Used {item.toolCalls.length} tool{item.toolCalls.length > 1 ? 's' : ''}: {item.toolCalls.map(t => t.tool.replace(/_/g, ' ')).join(', ')}
              </Text>
            </View>
          )}
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* ── Avatar section ── */}
      <View style={styles.avatarSection}>
        <GastoAvatar size={100} talking={talking} thinking={thinking} />
        <View style={styles.avatarInfo}>
          <Text style={styles.avatarName}>Gasto AI</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, {
              backgroundColor: analyzing ? '#FFE66D' : talking ? '#C8F135' : '#4ECDC4',
            }]} />
            <Text style={styles.statusText}>
              {analyzing ? 'Analyzing your spending...' : thinking ? 'Thinking...' : talking ? 'Speaking...' : 'Ready'}
            </Text>
          </View>
          <Text style={styles.poweredBy}>Powered by Gemini 2.0</Text>
        </View>
        <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* ── Messages ── */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          loading ? (
            <View style={styles.typingRow}>
              <View style={styles.smallAvatar}>
                <Text style={styles.smallAvatarText}>🤖</Text>
              </View>
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color="#C8F135" />
                <Text style={styles.typingText}>Gasto is thinking...</Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* ── Suggested questions ── */}
      {messages.length <= 2 && !loading && (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsLabel}>ASK ME</Text>
          <View style={styles.suggestionsRow}>
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <TouchableOpacity
                key={i}
                style={styles.suggestionChip}
                onPress={() => send(q)}
              >
                <Text style={styles.suggestionChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── Input bar ── */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Ask Gasto anything..."
          placeholderTextColor="#5A5A54"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => send()}
          submitBehavior="blurAndSubmit"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => send()}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },

  // ── Avatar section ──
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
    backgroundColor: '#0A0F0A',
    gap: 12,
  },
  avatarInfo: { flex: 1 },
  avatarName: { fontSize: 16, fontWeight: '700', color: '#F5F5F0' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, color: '#9A9A92' },
  poweredBy: { fontSize: 10, color: '#3A3A3A', marginTop: 3 },
  clearBtn: {
    backgroundColor: '#1E1E1E', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  clearBtnText: { fontSize: 12, color: '#9A9A92', fontWeight: '500' },

  // ── Messages ──
  messageList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowBot: { justifyContent: 'flex-start' },

  smallAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1E2A1E',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#C8F13530',
  },
  smallAvatarText: { fontSize: 14 },

  bubble: { maxWidth: '78%', borderRadius: 18, padding: 12 },
  bubbleUser: { backgroundColor: '#C8F135', borderBottomRightRadius: 4 },
  bubbleBot: {
    backgroundColor: '#1E1E1E', borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  bubbleAuto: {
    borderColor: '#C8F13540',
    backgroundColor: '#0F1A0F',
  },
  autoLabel: {
    fontSize: 9, fontWeight: '700', color: '#C8F135',
    letterSpacing: 1, marginBottom: 6,
  },
  bubbleText: { fontSize: 14, color: '#F5F5F0', lineHeight: 20 },
  bubbleTextUser: { color: '#0F0F0F' },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1E1E1E', borderRadius: 18, padding: 12,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  typingText: { fontSize: 13, color: '#9A9A92' },

  // ── Suggestions ──
  suggestions: { paddingHorizontal: 16, paddingBottom: 8 },
  suggestionsLabel: {
    fontSize: 10, fontWeight: '600', color: '#5A5A54',
    letterSpacing: 1.2, marginBottom: 8,
  },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: {
    backgroundColor: '#1E1E1E', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  suggestionChipText: { fontSize: 12, color: '#9A9A92' },

  // ── Input ──
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, borderTopWidth: 1, borderTopColor: '#1E1E1E',
    backgroundColor: '#0F0F0F',
  },
  input: {
    flex: 1, backgroundColor: '#1E1E1E', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: '#F5F5F0',
    maxHeight: 100, borderWidth: 1, borderColor: '#2A2A2A',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#C8F135',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.3 },
  toolCallsRow: {
    backgroundColor: '#0F1A0F',
    borderRadius: 8, padding: 6,
    marginBottom: 8,
    borderWidth: 1, borderColor: '#C8F13530',
  },
  toolCallsText: { fontSize: 10, color: '#C8F135', fontWeight: '600' },
  sendBtnText: { fontSize: 18, fontWeight: '700', color: '#0F0F0F' },
});
