import React, { useRef } from 'react';
import styles from '../ChatPage.module.css';

interface ChatInputAreaProps {
  messageText: string;
  sending: boolean;
  onMessageTextChange: (text: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTyping: () => void;
}

export const ChatInputArea: React.FC<ChatInputAreaProps> = ({
  messageText,
  sending,
  onMessageTextChange,
  onSendMessage,
  onFileSelect,
  onTyping,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage(e);
    }
  };

  return (
    <form onSubmit={onSendMessage} className={styles.chatInputContainer}>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={onFileSelect}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
      />

      <button
        type="button"
        className={styles.attachBtn}
        onClick={() => fileInputRef.current?.click()}
        title="Attach image, document, or file"
        disabled={sending}
      >
        📎
      </button>

      <textarea
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

      <button
        type="submit"
        className={styles.sendBtn}
        disabled={!messageText.trim() || sending}
        title="Send message"
      >
        {sending ? <span className={styles.sendingDot} /> : '➤'}
      </button>
    </form>
  );
};

export default ChatInputArea;
