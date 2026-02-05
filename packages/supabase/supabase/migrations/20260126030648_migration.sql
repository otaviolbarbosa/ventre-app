-- Fix the calculate_gestational_week function
-- The issue: (date - date) returns an integer (days), not an interval
-- extract() doesn't work on integers, only on intervals/timestamps
CREATE OR REPLACE FUNCTION public.calculate_gestational_week(p_due_date date)
RETURNS integer
LANGUAGE plpgsql
AS $$
declare
  conception_date date;
  weeks_pregnant int;
begin
  -- Calculate estimated conception date (40 weeks before due date)
  conception_date := p_due_date - interval '280 days';
  -- Calculate weeks since conception
  -- Note: date - date returns integer (days) in PostgreSQL, so no extract needed
  weeks_pregnant := (current_date - conception_date) / 7;
  -- Ensure it's within valid range (0-42 weeks)
  if weeks_pregnant < 0 then
    return 0;
  elsif weeks_pregnant > 42 then
    return 42;
  else
    return weeks_pregnant;
  end if;
end;
$$;