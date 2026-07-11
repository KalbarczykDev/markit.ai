CREATE TABLE IF NOT EXISTS conversation_session (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  product_state TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS conversation_session_user_updated_idx
  ON conversation_session(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS conversation_message (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  realtime_item_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversation_session(id) ON DELETE CASCADE,
  UNIQUE(conversation_id, realtime_item_id)
);

CREATE INDEX IF NOT EXISTS conversation_message_conversation_created_idx
  ON conversation_message(conversation_id, created_at);
