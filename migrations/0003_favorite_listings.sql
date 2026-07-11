PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS `favorite_listing` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `url` text NOT NULL,
  `title` text NOT NULL,
  `source` text NOT NULL,
  `price` text,
  `image` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `favorite_listing_user_url_unique`
  ON `favorite_listing` (`user_id`, `url`);
CREATE INDEX IF NOT EXISTS `favorite_listing_user_created_idx`
  ON `favorite_listing` (`user_id`, `created_at` DESC);
