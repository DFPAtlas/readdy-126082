-- DFP AI OPERATIONS — PHASE 2 PROMPT 06A
-- Approval History FK Hardening
--
-- Changes the delete behaviour of ai_approval_history.approval_id
-- from ON DELETE CASCADE to ON DELETE RESTRICT, so that deleting an
-- approval can never silently destroy its append-only governance history.
--
-- Scope: FK constraint only. No table recreate, no data change, no RLS change.

-- 1. Drop the existing CASCADE foreign key.
ALTER TABLE ai_approval_history
  DROP CONSTRAINT IF EXISTS ai_approval_history_approval_id_fkey;

-- 2. Recreate the same foreign key with ON DELETE RESTRICT.
ALTER TABLE ai_approval_history
  ADD CONSTRAINT ai_approval_history_approval_id_fkey
  FOREIGN KEY (approval_id)
  REFERENCES ai_approvals(id)
  ON DELETE RESTRICT;