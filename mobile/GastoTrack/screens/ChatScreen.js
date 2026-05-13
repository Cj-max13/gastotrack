/**
 * ChatScreen.js — "Gasto" AI Assistant
 * Redesigned to match the light-theme mockup.
 * - Gasto branding (not "AI Assistant")
 * - Welcome header with icon + tagline
 * - First message from Gasto with spending analysis
 * - Suggested question chips
 * - Clean white input bar with send button
 * - Chat history persisted in AsyncStorage
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Keyboard, ScrollView, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendChatMessage } from '../Services/api';

const CHAT_HISTORY_KEY = 'gasto_chat_history';

// ── Suggested questions ───────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: '☕', text: 'How much did I spend on coffee this week?' },
  { icon: '🐷', text: 'Am I on track for my savings goal?' },
  { icon: '📋', text: 'Find my largest transaction this month.' },
  { icon: '✦',  text: 'Give me tips to reduce utility bills.' },
];

// ── Welcome message from Gasto ────────────────────────────────────────────────
const WELCOME = {
  id:   'welcome',
  role: 'model',
  text: "Hello! I've analyzed your transactions from the last 30 days. You've been doing great with your grocery budget, but I noticed a 15% increase in dining out. Would you like to see a breakdown?",
};

export default function ChatScreen() {
  const [messages, setMessages]   = useState([WELCOME]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [token, setToken]         = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const listRef = useRef(null);

  // ── Load token + persisted history ───────────────────────────────────────
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
      } catch { /* ignore */ }
    };
    init();
  }, []);

  // ── Persist messages ──────────────────────────────────────────────────────
  useEffect(() => {
    const toSave = messages.filter(m => m.id !== 'welcome');
    if (toSave.length > 0) {
      AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toSave)).catch(() => {});
    }
  }, [messages]);

  // ── Build history for agent ───────────────────────────────────────────────
  const buildHistory = useCallback((msgs) =>
    msgs
      .filter(m => m.id !== 'welcome')
      .slice(-10)
      .map(m => ({ role: m.role, parts: [m.text] })),
  []);

  // ── Send message ──────────────────────────────────────────────────────────
  const send = useCallback(async (overrideText) => {
    const trimmed = (overrideText || input).trim();
    if (!trimmed || loading) return;

    Keyboard.dismiss();
    setInput('');
    setShowSuggestions(false);

    const userMsg = { id: Date.now().toString(), role: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = buildHistory(messages);
      const res = await sendChatMessage(trimmed, history, token);
      const botMsg = {
        id:        (Date.now() + 1).toString(),
        role:      'model',
        text:      res.data.reply,
        toolCalls: res.data.tool_calls || [],
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      const isNetwork = !e.response;
      setMessages(prev => [...prev, {
        id:   (Date.now() + 1).toString(),
        role: 'model',
        text: isNetwork
          ? "🔌 Can't reach Gasto right now. Make sure the AI service is running."
          : "😔 Something went wrong. Please try again.",
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [input, messages, loading, token, buildHistory]);

  // ── Clear chat ────────────────────────────────────────────────────────────
  const clearChat = () => {
    setMessages([WELCOME]);
    setShowSuggestions(true);
    AsyncStorage.removeItem(CHAT_HISTORY_KEY).catch(() => {});
  };

  // ── Render message bubble ─────────────────────────────────────────────────
  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}>
        {!isUser && (
          <View style={styles.gastoAvatar}>
            <Text style={styles.gastoAvatarIcon}>🤖</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          {/* Tool usage indicator */}
          {item.toolCalls?.length > 0 && (
            <View style={styles.toolBadge}>
              <Text style={styles.toolBadgeText}>
                🔧 {item.toolCalls.map(t => t.tool.replace(/_/g, ' ')).join(' · ')}
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
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          /* ── Welcome header ── */
          <View style={styles.welcomeHeader}>
            <View style={styles.welcomeIconWrap}>
              <Text style={styles.welcomeIcon}>🤖</Text>
            </View>
            <Text style={styles.welcomeTitle}>How can I help with your{'\n'}finances today?</Text>
            <Text style={styles.welcomeSub}>
              Your Gasto assistant is ready to analyze your{'\n'}spending and budgeting patterns.
            </Text>
          </View>
        }
        ListFooterComponent={
          <>
            {/* Typing indicator */}
            {loading && (
              <View style={styles.msgRowBot}>
                <View style={styles.gastoAvatar}>
                  <Text style={styles.gastoAvatarIcon}>🤖</Text>
                </View>
                <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
                  <ActivityIndicator size="small" color="#00897B" />
                  <Text style={styles.typingText}>Gasto is thinking...</Text>
                </View>
              </View>
            )}

            {/* Suggested questions */}
            {showSuggestions && !loading && (
              <View style={styles.suggestionsWrap}>
                {SUGGESTIONS.map((q, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.suggestionRow}
                    onPress={() => send(q.text)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggestionIcon}>{q.icon}</Text>
                    <Text style={styles.suggestionText}>{q.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        }
      />

      {/* ── Input bar ── */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.attachBtn}>
          <Text style={styles.attachIcon}>📎</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Ask Gasto..."
          placeholderTextColor="#AAAAAA"
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
          <Text style={styles.sendBtnIcon}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>Gasto can make mistakes. Verify important financial data.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  // ── Welcome header ──
  welcomeHeader: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  welcomeIconWrap: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: '#00897B',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#00897B', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  welcomeIcon:  { fontSize: 32 },
  welcomeTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', lineHeight: 30, marginBottom: 10 },
  welcomeSub:   { fontSize: 13, color: '#9E9E9E', textAlign: 'center', lineHeight: 20 },

  // ── Messages ──
  messageList: { paddingHorizontal: 16, paddingBottom: 8 },
  msgRow:     { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowBot:  { justifyContent: 'flex-start' },

  gastoAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#E0F2F1',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#B2DFDB',
  },
  gastoAvatarIcon: { fontSize: 16 },

  bubble: { maxWidth: '78%', borderRadius: 18, padding: 14 },
  bubbleUser: {
    backgroundColor: '#00897B',
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#EEEEEE',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  bubbleText:     { fontSize: 14, color: '#1A1A1A', lineHeight: 21 },
  bubbleTextUser: { color: '#FFFFFF' },

  // Tool badge
  toolBadge: {
    backgroundColor: '#E0F2F1', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    marginBottom: 8,
  },
  toolBadgeText: { fontSize: 9, color: '#00897B', fontWeight: '700', letterSpacing: 0.3 },

  // Typing
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText:   { fontSize: 13, color: '#9E9E9E' },

  // ── Suggestions ──
  suggestionsWrap: { marginTop: 8, gap: 8 },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#EEEEEE',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 2, elevation: 1,
  },
  suggestionIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  suggestionText: { flex: 1, fontSize: 14, color: '#1A1A1A', fontWeight: '500' },

  // ── Input bar ──
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#EEEEEE',
  },
  attachBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  attachIcon: { fontSize: 20, color: '#9E9E9E' },
  input: {
    flex: 1, backgroundColor: '#F5F5F5', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: '#1A1A1A',
    maxHeight: 100, borderWidth: 1, borderColor: '#EEEEEE',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#00897B',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#B2DFDB' },
  sendBtnIcon:     { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },

  disclaimer: {
    fontSize: 10, color: '#BDBDBD', textAlign: 'center',
    paddingBottom: 8, backgroundColor: '#FFFFFF',
  },
});
