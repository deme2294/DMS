import React, { useRef, useEffect, useState } from 'react';
import {
  PaperClipIcon,
  PaperAirplaneIcon,
  FaceSmileIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import styles from '../ChatPage.module.css';

interface ChatInputAreaProps {
  messageText: string;
  sending: boolean;
  onMessageTextChange: (text: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTyping: () => void;
}

const QUICK_EMOJIS = ['👍', '✅', '😊', '🙌', '🚀', '💡', '👏', '🎯', '🤝', '❤️'];

export const ChatInputArea: React.FC<ChatInputAreaProps> = ({
  messageText,
  sending,
  onMessageTextChange,
  onSendMessage,
  onFileSelect,
  onTyping,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Auto-resize textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 40), 130)}px`;
    }
  }, [messageText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (messageText.trim() && !sending) {
        onSendMessage(e);
        if (textareaRef.current) {
          textareaRef.current.style.height = '40px';
        }
      }
    }
  };

  const handleAddEmoji = (emoji: string) => {
    onMessageTextChange(messageText + emoji);
    onTyping();
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim() && !sending) {
      onSendMessage(e);
      if (textareaRef.current) {
        textareaRef.current.style.height = '40px';
      }
    }
  };

  return (
    <div className={styles.chatInputWrapper}>
      {/* Quick emoji drawer */}
      {showEmojiPicker && (
        <div className={styles.quickEmojiBar}>
          <div className={styles.quickEmojiList}>
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={styles.quickEmojiBtn}
                onClick={() => handleAddEmoji(emoji)}
                title={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.closeEmojiBtn}
            onClick={() => setShowEmojiPicker(false)}
            title="Close emoji tray"
            aria-label="Close emoji picker"
          >
            <XMarkIcon className={styles.closeEmojiIcon} />
          </button>
        </div>
      )}

      <form onSubmit={handleFormSubmit} className={styles.chatInputContainer}>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => {
            onFileSelect(e);
            if (e.target) e.target.value = '';
          }}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z"
        />

        <div className={styles.inputActionLeft}>
          <button
            type="button"
            className={styles.attachBtn}
            onClick={() => fileInputRef.current?.click()}
            title="Attach image, document, or file (Max 10MB)"
            disabled={sending}
            aria-label="Attach file"
          >
            <PaperClipIcon className={styles.inputIconSvg} />
          </button>

          <button
            type="button"
            className={`${styles.emojiToggleBtn} ${showEmojiPicker ? styles.emojiToggleBtnActive : ''}`}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Insert quick reaction emoji"
            disabled={sending}
            aria-label="Quick emojis"
          >
            <FaceSmileIcon className={styles.inputIconSvg} />
          </button>
        </div>

        <div className={styles.inputFieldContainer}>
          <textarea
            ref={textareaRef}
            value={messageText}
            onChange={(e) => {
              onMessageTextChange(e.target.value);
              onTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here... (Enter to send, Shift+Enter for newline)"
            className={styles.messageInput}
            rows={1}
            disabled={sending}
          />
          <div className={styles.inputHelperBar}>
            <span className={styles.keyboardShortcutHint}>
              Press <kbd className={styles.hintKbd}>↵ Enter</kbd> to send, <kbd className={styles.hintKbd}>Shift</kbd>+<kbd className={styles.hintKbd}>↵</kbd> for newline
            </span>
          </div>
        </div>

        <button
          type="submit"
          className={styles.sendBtn}
          disabled={!messageText.trim() || sending}
          title="Send message (Enter)"
          aria-label="Send message"
        >
          {sending ? (
            <span className={styles.sendingDot} />
          ) : (
            <PaperAirplaneIcon className={styles.sendIconSvg} />
          )}
        </button>
      </form>
    </div>
  );
};

export default ChatInputArea;
