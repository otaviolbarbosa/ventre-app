alter table public.lab_exam_results
  drop column if exists hemoglobin_electrophoresis;

drop type if exists public.hemoglobin_electrophoresis_result;
