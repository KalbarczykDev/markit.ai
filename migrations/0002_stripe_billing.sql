ALTER TABLE `user` ADD COLUMN `billing_status` text DEFAULT 'inactive' NOT NULL;
ALTER TABLE `user` ADD COLUMN `stripe_customer_id` text;
ALTER TABLE `user` ADD COLUMN `stripe_subscription_id` text;
ALTER TABLE `user` ADD COLUMN `stripe_product_id` text;

CREATE UNIQUE INDEX IF NOT EXISTS `user_stripe_customer_unique`
  ON `user` (`stripe_customer_id`)
  WHERE `stripe_customer_id` IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS `user_stripe_subscription_unique`
  ON `user` (`stripe_subscription_id`)
  WHERE `stripe_subscription_id` IS NOT NULL;
