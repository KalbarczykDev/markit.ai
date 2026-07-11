PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS `price_alert_setting` (
  `user_id` text PRIMARY KEY NOT NULL,
  `enabled` integer DEFAULT 0 NOT NULL,
  `telegram_chat_id` text NOT NULL,
  `interval_value` integer DEFAULT 15 NOT NULL,
  `interval_unit` text DEFAULT 'minutes' NOT NULL CHECK (`interval_unit` IN ('seconds', 'minutes')),
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `price_alert_listing_state` (
  `listing_id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `price_value` real NOT NULL,
  `currency` text NOT NULL,
  `checked_at` integer NOT NULL,
  FOREIGN KEY (`listing_id`) REFERENCES `favorite_listing` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `price_alert_listing_state_user_idx`
  ON `price_alert_listing_state` (`user_id`);
