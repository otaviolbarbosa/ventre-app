-- Add parties_details JSONB to store a frozen snapshot of the contract parties
-- (contratante, contratada, equipe de cuidado) at the time a patient contract is saved.
-- Only patient contracts (is_base_contract = false) ever have this populated.
-- Base contract templates always leave this NULL.
ALTER TABLE public.contracts
  ADD COLUMN parties_details jsonb;
