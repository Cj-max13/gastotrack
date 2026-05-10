/**
 * ChatScreen.js
 * AI chatbot powered by Gemini via the FastAPI agent.
 * - Sends JWT token so agent can fetch real spending data
 * - Persists conversation history in AsyncStorage per session
 * - Shows tool usage indicators when agent fetches live data
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Keyboard, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendChatMessage } from '../Services/api';
import GastoAvatar from '../components/GastoAvatar';

// ── Suggested questions — Filipino context ────────────────────────────────────
const SUGGESTED_QUESTIONS = [
  { label: '📊 This month', text: 'How much have I spent this month?' },
  { label: '🎯 Budget check', text: 'Am I over budget on any category?' },
  { label: '🏆 Top merchants', text: 'Where do I spend the most?' },
  { label: '🍔 Food spending', text: 'How much did I spend on food?' },
  { label: '💡 Save money', text: 'Give me tips to save money this month.' },
  { label: '➕ Add expense', text: 'Add: Spent ₱150 at Jollibee' },
];

const WELCOME = {
  id: 'welcome',
  role: 'model',
  text: "Hi! I'm Gasto 👋, your personal finance assistant.\n\nAsk me anything about your spending — I can check your real transaction data, budget status, and give personalized advice.\n\nWhat would you like to know?",
};

const CHAT_HISTORY_KEY = 'gasto_chat_history';

export default function ChatScreen() {
  const [messages, setMessages]   = useState([WELCOME]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [talking, setTalking]     = useState(false);
  const [thinking, setThinking]   = useState(false);
  const [token, setToken]         = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const listRef     = useRef(null);
  const talkTimerRef = useRef(null);

  // ── Load token + persisted history on mount ───────────────────────────────
  useEffect(() => {
    const init = async () => {
      const t = await AsyncStorage.getItem('token');
      setToken(t);

      try {
        const saved = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages([WELCOME, ...parsed]);
            setShowSuggestions(false);
          }
        }
      } catch { /* ignore parse errors */ }
    };
    init();
  }, []);

  // ── Persist messages whenever they change ─────────────────────────────────
  useEffect(() => {
    const toSave = messages.filter(m => m.id !== 'welcome');
    if (toSave.length > 0) {
      AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toSave)).catch(() => {});
    }
  }, [messages]);

  // ── Avatar talking animation ──────────────────────────────────────────────
  const triggerTalking = (text) => {
    clearTimeout(talkTimerRef.current);
    setTalking(true);
    const duration = Math.min(Math.max(text.length * 35, 1500), 7000);
    talkTimerRef.current = setTimeout(() => setTalking(false), duration);
  };

  // ── Build history for the agent (exclude welcome + system messages) ───────
  const buildHistory = useCallback((msgs) =>
    msgs
      .filter(m => m.id !== 'welcome')
      .slice(-10) // keep last 10 turns to avoid token overflow
      .map(m => ({ role: m.role, parts: [m.text] })),
  []);

  // ── Send message ──────────────────────────────────────────────────────────
  const send = useCallback(async (overrideText) => {
    const trimmed = (overrideText || input).trim();
    if (!trimmed || loading) return;

    Keyboard.dismiss();
    setInput('');
    setShowSuggestions(false);

    const userMsg = {
      id:   Date.now().toString(),
      role: 'user',
      text: trimmed,
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setThinking(true);

    try {
      const history = buildHistory(messages); // history before this message
      const res = await sendChatMessage(trimmed, history, token);

      const botMsg = {
        id:        (Date.now() + 1).toString(),
        role:      'model',
        text:      res.data.reply,
        toolCalls: res.data.tool_calls || [],
        steps:     res.data.steps || 0,
      };

      setMessages(prev => [...prev, botMsg]);
      triggerTalking(res.data.reply);
    } catch (e) {
      const isNetworkError = !e.response;
      const errMsg = {
        id:   (Date.now() + 1).toString(),
        role: 'model',
        text: isNetworkError
          ? "🔌 Can't reach the AI service. Make sure it's running:\n\nuvicorn app.main:app --host 0.0.0.0 --port 8000"
          : `😔 Something went wrong. (${e.response?.status || 'unknown error'})`,
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setThinking(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [input, messages, loading, token, buildHistory]);

  // ── Clear chat ────────────────────────────────────────────────────────────
  const clearChat = () => {
    setMessages([WELCOME]);
    setShowSuggestions(true);
    setTalking(false);
    clearTimeout(talkTimerRef.current);
    AsyncStorage.removeItem(CHAT_HISTORY_KEY).catch(() => {});
  };

  // ── Render a single message bubble ───────────────────────────────────────
  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}>
        {!isUser && (
          <View style={styles.smallAvatar}>
            <Text style={styles.smallAvatarText}>🤖</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          {/* Tool usage badge — shows when agent fetched live data */}
          {item.toolCalls?.length > 0 && (
            <View style={styles.toolBadge}>
              <Text style={styles.toolBadgeText}>
                🔧 {item.toolCalls.map(t =>
                  t.tool.replace(/_/g, ' ')
                ).join(' · ')}
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
      {/* ── Avatar header ── */}
      <View style={styles.avatarSection}>
        <GastoAvatar size={90} talking={talking} thinking={thinking} />
        <View style={styles.avatarInfo}>
          <Text style={styles.avatarName}>Gasto AI</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, {
              backgroundColor: thinking ? '#FFE66D' : talking ? '#C8F135' : '#4ECDC4',
            }]} />
            <Text style={styles.statusText}>
              {thinking ? 'Fetching your data...' : talking ? 'Responding...' : 'Ready'}
            </Text>
          </View>
          <Text style={styles.poweredBy}>Powered by Gemini 2.0 · Live data</Text>
        </View>
        <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* ── Message list ── */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
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

      {/* ── Suggested questions (shown when chat is fresh) ── */}
      {showSuggestions && !loading && (
        <View style={styles.suggestionsWrap}>
          <Text style={styles.suggestionsLabel}>QUICK QUESTIONS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsRow}
          >
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <TouchableOpacity
                key={i}
                style={styles.suggestionChip}
                onPress={() => send(q.text)}
              >
                <Text style={styles.suggestionChipText}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Input bar ── */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Ask about your spending..."
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

  // ── Avatar header ──
  avatarSection: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
    backgroundColor: '#0A0F0A',
  },
  avatarInfo:  { flex: 1 },
  avatarName:  { fontSize: 15, fontWeight: '700', color: '#F5F5F0' },
  statusRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot:   { width: 7, height: 7, borderRadius: 4 },
  statusText:  { fontSize: 11, color: '#9A9A92' },
  poweredBy:   { fontSize: 9, color: '#3A3A3A', marginTop: 2 },
  clearBtn: {
    backgroundColor: '#1A1A1A', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  clearBtnText: { fontSize: 11, color: '#5A5A54', fontWeight: '500' },

  // ── Messages ──
  messageList: { padding: 14, paddingBottom: 8 },
  msgRow: {
    flexDirection: 'row', marginBottom: 10,
    alignItems: 'flex-end', gap: 8,
  },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowBot:  { justifyContent: 'flex-start' },

  smallAvatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#1A2A1A',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#C8F13530',
  },
  smallAvatarText: { fontSize: 13 },

  bubble: { maxWidth: '80%', borderRadius: 18, padding: 12 },
  bubbleUser: {
    backgroundColor: '#C8F135',
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: '#1A1A1A',
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  bubbleText:     { fontSize: 14, color: '#F5F5F0', lineHeight: 20 },
  bubbleTextUser: { color: '#0F0F0F' },

  // Tool usage badge
  toolBadge: {
    backgroundColor: '#0F1A0F', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    marginBottom: 8,
    borderWidth: 1, borderColor: '#C8F13530',
  },
  toolBadgeText: {
    fontSize: 9, color: '#C8F135',
    fontWeight: '600', letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // Typing indicator
  typingRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 10, paddingHorizontal: 14,
  },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1A1A1A', borderRadius: 18, padding: 12,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  typingText: { fontSize: 13, color: '#9A9A92' },

  // ── Suggestions ──
  suggestionsWrap: {
    paddingTop: 8, paddingBottom: 4,
    borderTopWidth: 1, borderTopColor: '#1A1A1A',
  },
  suggestionsLabel: {
    fontSize: 9, fontWeight: '700', color: '#3A3A3A',
    letterSpacing: 1.2, marginBottom: 6, paddingHorizontal: 16,
  },
  suggestionsRow: { paddingHorizontal: 12, gap: 8 },
  suggestionChip: {
    backgroundColor: '#1A1A1A', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#2A2A2A',
    height: 34, justifyContent: 'center',
  },
  suggestionChipText: { fontSize: 12, color: '#9A9A92', fontWeight: '500' },

  // ── Input bar ──
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12,
    borderTopWidth: 1, borderTopColor: '#1A1A1A',
    backgroundColor: '#0F0F0F',
  },
  input: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 20,
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
  sendBtnText: { fontSize: 18, fontWeight: '700', color: '#0F0F0F' },
});
