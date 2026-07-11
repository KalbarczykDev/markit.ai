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

ALTER TABLE `favorite_listing` ADD COLUMN `alert_price_value` real;
ALTER TABLE `favorite_listing` ADD COLUMN `alert_currency` text;
ALTER TABLE `favorite_listing` ADD COLUMN `alert_checked_at` integer;
