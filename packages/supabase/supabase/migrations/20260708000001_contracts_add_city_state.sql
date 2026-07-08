-- Stores the contract's locality (city/state), used to compose the
-- "Cidade/UF, DD de mês de AAAA." line on the signature block.
ALTER TABLE public.contracts
  ADD COLUMN city text,
  ADD COLUMN state text;
