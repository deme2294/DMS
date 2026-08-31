-- Add department_ids column to ticket_replies for admin internal note visibility
ALTER TABLE ticket_replies
  ADD COLUMN department_ids VARCHAR(500) NULL AFTER is_internal;
