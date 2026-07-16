-- Deal value captured when a lead closes, so the owner dashboard can show
-- revenue closed this month. NULL until a deal is actually closed.
ALTER TABLE leads ADD COLUMN deal_value REAL;
