export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_name: string
          action_type: string
          created_at: string
          description: string
          enterprise_id: string
          id: string
          metadata: Json
          patient_id: string | null
          user_id: string
        }
        Insert: {
          action_name: string
          action_type: string
          created_at?: string
          description: string
          enterprise_id: string
          id?: string
          metadata?: Json
          patient_id?: string | null
          user_id: string
        }
        Update: {
          action_name?: string
          action_type?: string
          created_at?: string
          description?: string
          enterprise_id?: string
          id?: string
          metadata?: Json
          patient_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      addresses: {
        Row: {
          city: string | null
          complement: string | null
          created_at: string
          id: string
          neighborhood: string | null
          number: string | null
          patient_id: string | null
          state: string | null
          street: string | null
          updated_at: string
          user_id: string | null
          zipcode: string | null
        }
        Insert: {
          city?: string | null
          complement?: string | null
          created_at?: string
          id?: string
          neighborhood?: string | null
          number?: string | null
          patient_id?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string | null
          zipcode?: string | null
        }
        Update: {
          city?: string | null
          complement?: string | null
          created_at?: string
          id?: string
          neighborhood?: string | null
          number?: string | null
          patient_id?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string | null
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          confirmed_by_patient_at: string | null
          created_at: string | null
          date: string
          duration: number | null
          enterprise_id: string | null
          external_patient_email: string | null
          external_patient_name: string | null
          external_patient_phone: string | null
          google_event_id: string | null
          id: string
          location: string | null
          notes: string | null
          patient_id: string | null
          professional_id: string
          status: Database["public"]["Enums"]["appointment_status"]
          time: string
          type: Database["public"]["Enums"]["appointment_type"]
          updated_at: string | null
        }
        Insert: {
          confirmed_by_patient_at?: string | null
          created_at?: string | null
          date: string
          duration?: number | null
          enterprise_id?: string | null
          external_patient_email?: string | null
          external_patient_name?: string | null
          external_patient_phone?: string | null
          google_event_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          patient_id?: string | null
          professional_id: string
          status?: Database["public"]["Enums"]["appointment_status"]
          time: string
          type: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string | null
        }
        Update: {
          confirmed_by_patient_at?: string | null
          created_at?: string | null
          date?: string
          duration?: number | null
          enterprise_id?: string | null
          external_patient_email?: string | null
          external_patient_name?: string | null
          external_patient_phone?: string | null
          google_event_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          patient_id?: string | null
          professional_id?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          time?: string
          type?: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_notification_preferences: {
        Row: {
          created_at: string
          enable_billing_reminders: boolean
          enable_payment_confirmations: boolean
          reminder_days_before: number[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enable_billing_reminders?: boolean
          enable_payment_confirmations?: boolean
          reminder_days_before?: number[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enable_billing_reminders?: boolean
          enable_payment_confirmations?: boolean
          reminder_days_before?: number[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      billings: {
        Row: {
          applied_billing_fees: Json
          created_at: string
          description: string
          enterprise_id: string | null
          id: string
          installment_count: number
          installment_interval: number | null
          installments_dates: string[] | null
          notes: string | null
          paid_amount: number
          patient_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          splitted_billing: Json
          status: Database["public"]["Enums"]["billing_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          applied_billing_fees?: Json
          created_at?: string
          description: string
          enterprise_id?: string | null
          id?: string
          installment_count?: number
          installment_interval?: number | null
          installments_dates?: string[] | null
          notes?: string | null
          paid_amount?: number
          patient_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          splitted_billing?: Json
          status?: Database["public"]["Enums"]["billing_status"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          applied_billing_fees?: Json
          created_at?: string
          description?: string
          enterprise_id?: string | null
          id?: string
          installment_count?: number
          installment_interval?: number | null
          installments_dates?: string[] | null
          notes?: string | null
          paid_amount?: number
          patient_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          splitted_billing?: Json
          status?: Database["public"]["Enums"]["billing_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billings_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      birth_amniotic_fluid_records: {
        Row: {
          created_at: string
          fluid_type: Database["public"]["Enums"]["birth_amniotic_fluid_type"]
          id: string
          measured_at: string
          patient_id: string
          pregnancy_id: string
          professional_id: string
        }
        Insert: {
          created_at?: string
          fluid_type: Database["public"]["Enums"]["birth_amniotic_fluid_type"]
          id?: string
          measured_at?: string
          patient_id: string
          pregnancy_id: string
          professional_id: string
        }
        Update: {
          created_at?: string
          fluid_type?: Database["public"]["Enums"]["birth_amniotic_fluid_type"]
          id?: string
          measured_at?: string
          patient_id?: string
          pregnancy_id?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "birth_amniotic_fluid_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birth_amniotic_fluid_records_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: false
            referencedRelation: "pregnancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birth_amniotic_fluid_records_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      birth_apgar_scores: {
        Row: {
          activity: number
          appearance: number
          created_at: string
          grimace: number
          id: string
          minute: number
          patient_id: string
          pregnancy_id: string
          professional_id: string
          pulse: number
          respiration: number
          total: number | null
        }
        Insert: {
          activity: number
          appearance: number
          created_at?: string
          grimace: number
          id?: string
          minute: number
          patient_id: string
          pregnancy_id: string
          professional_id: string
          pulse: number
          respiration: number
          total?: number | null
        }
        Update: {
          activity?: number
          appearance?: number
          created_at?: string
          grimace?: number
          id?: string
          minute?: number
          patient_id?: string
          pregnancy_id?: string
          professional_id?: string
          pulse?: number
          respiration?: number
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "birth_apgar_scores_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birth_apgar_scores_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: false
            referencedRelation: "pregnancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birth_apgar_scores_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      birth_cervical_dilations: {
        Row: {
          created_at: string
          dilation_cm: number
          id: string
          measured_at: string
          patient_id: string
          pregnancy_id: string
          professional_id: string
        }
        Insert: {
          created_at?: string
          dilation_cm: number
          id?: string
          measured_at?: string
          patient_id: string
          pregnancy_id: string
          professional_id: string
        }
        Update: {
          created_at?: string
          dilation_cm?: number
          id?: string
          measured_at?: string
          patient_id?: string
          pregnancy_id?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "birth_cervical_dilations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birth_cervical_dilations_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: false
            referencedRelation: "pregnancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birth_cervical_dilations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      birth_contractions: {
        Row: {
          created_at: string
          duration_seconds: number
          effectiveness:
            | Database["public"]["Enums"]["birth_contraction_effectiveness"]
            | null
          id: string
          measured_at: string
          patient_id: string
          pregnancy_id: string
          professional_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds: number
          effectiveness?:
            | Database["public"]["Enums"]["birth_contraction_effectiveness"]
            | null
          id?: string
          measured_at?: string
          patient_id: string
          pregnancy_id: string
          professional_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          effectiveness?:
            | Database["public"]["Enums"]["birth_contraction_effectiveness"]
            | null
          id?: string
          measured_at?: string
          patient_id?: string
          pregnancy_id?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "birth_contractions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birth_contractions_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: false
            referencedRelation: "pregnancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birth_contractions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      birth_fetal_heart_rates: {
        Row: {
          bpm: number
          created_at: string
          id: string
          measured_at: string
          patient_id: string
          pregnancy_id: string
          professional_id: string
        }
        Insert: {
          bpm: number
          created_at?: string
          id?: string
          measured_at?: string
          patient_id: string
          pregnancy_id: string
          professional_id: string
        }
        Update: {
          bpm?: number
          created_at?: string
          id?: string
          measured_at?: string
          patient_id?: string
          pregnancy_id?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "birth_fetal_heart_rates_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birth_fetal_heart_rates_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: false
            referencedRelation: "pregnancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birth_fetal_heart_rates_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      birth_fetal_stations: {
        Row: {
          created_at: string
          id: string
          measured_at: string
          patient_id: string
          pregnancy_id: string
          professional_id: string
          station_lee: number
        }
        Insert: {
          created_at?: string
          id?: string
          measured_at?: string
          patient_id: string
          pregnancy_id: string
          professional_id: string
          station_lee: number
        }
        Update: {
          created_at?: string
          id?: string
          measured_at?: string
          patient_id?: string
          pregnancy_id?: string
          professional_id?: string
          station_lee?: number
        }
        Relationships: [
          {
            foreignKeyName: "birth_fetal_stations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birth_fetal_stations_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: false
            referencedRelation: "pregnancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birth_fetal_stations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      birth_medication_administrations: {
        Row: {
          administered_at: string
          created_at: string
          id: string
          medication_type: Database["public"]["Enums"]["birth_medication_type"]
          notes: string | null
          other_birth_medication_type: string | null
          patient_id: string
          pregnancy_id: string
          professional_id: string
        }
        Insert: {
          administered_at?: string
          created_at?: string
          id?: string
          medication_type: Database["public"]["Enums"]["birth_medication_type"]
          notes?: string | null
          other_birth_medication_type?: string | null
          patient_id: string
          pregnancy_id: string
          professional_id: string
        }
        Update: {
          administered_at?: string
          created_at?: string
          id?: string
          medication_type?: Database["public"]["Enums"]["birth_medication_type"]
          notes?: string | null
          other_birth_medication_type?: string | null
          patient_id?: string
          pregnancy_id?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "birth_medication_administrations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birth_medication_administrations_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: false
            referencedRelation: "pregnancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birth_medication_administrations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      birth_membrane_ruptures: {
        Row: {
          created_at: string
          id: string
          occurred_at: string
          patient_id: string
          pregnancy_id: string
          professional_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          occurred_at?: string
          patient_id: string
          pregnancy_id: string
          professional_id: string
        }
        Update: {
          created_at?: string
          id?: string
          occurred_at?: string
          patient_id?: string
          pregnancy_id?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "birth_membrane_ruptures_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birth_membrane_ruptures_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: true
            referencedRelation: "pregnancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birth_membrane_ruptures_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_change_requests: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          message_html: string
          patient_id: string
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          message_html: string
          patient_id: string
          requested_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          message_html?: string
          patient_id?: string
          requested_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_change_requests_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_change_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_change_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          signed_at: string
          signed_ip: string | null
          signed_user_agent: string | null
          signer_id: string
          signer_role: string
          verification_code: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          signed_at?: string
          signed_ip?: string | null
          signed_user_agent?: string | null
          signer_id: string
          signer_role: string
          verification_code?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          signed_at?: string
          signed_ip?: string | null
          signed_user_agent?: string | null
          signer_id?: string
          signer_role?: string
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          city: string | null
          clauses_html: string
          content_hash: string | null
          created_at: string
          enterprise_id: string | null
          finalized_content_hash: string | null
          finalized_document_id: string | null
          fully_signed_at: string | null
          id: string
          is_active: boolean | null
          is_base_contract: boolean
          is_signed: boolean
          name: string | null
          original_document_id: string | null
          parties_details: Json | null
          patient_id: string | null
          pregnancy_id: string | null
          revoked_at: string | null
          revoked_by: string | null
          signed_at: string | null
          signed_by: string | null
          signed_ip: string | null
          signed_user_agent: string | null
          state: string | null
          title: string
          updated_at: string
          user_id: string | null
          verification_code: string | null
        }
        Insert: {
          city?: string | null
          clauses_html?: string
          content_hash?: string | null
          created_at?: string
          enterprise_id?: string | null
          finalized_content_hash?: string | null
          finalized_document_id?: string | null
          fully_signed_at?: string | null
          id?: string
          is_active?: boolean | null
          is_base_contract?: boolean
          is_signed?: boolean
          name?: string | null
          original_document_id?: string | null
          parties_details?: Json | null
          patient_id?: string | null
          pregnancy_id?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signed_ip?: string | null
          signed_user_agent?: string | null
          state?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
          verification_code?: string | null
        }
        Update: {
          city?: string | null
          clauses_html?: string
          content_hash?: string | null
          created_at?: string
          enterprise_id?: string | null
          finalized_content_hash?: string | null
          finalized_document_id?: string | null
          fully_signed_at?: string | null
          id?: string
          is_active?: boolean | null
          is_base_contract?: boolean
          is_signed?: boolean
          name?: string | null
          original_document_id?: string | null
          parties_details?: Json | null
          patient_id?: string | null
          pregnancy_id?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signed_ip?: string | null
          signed_user_agent?: string | null
          state?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_finalized_document_id_fkey"
            columns: ["finalized_document_id"]
            isOneToOne: false
            referencedRelation: "patient_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: false
            referencedRelation: "pregnancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_signed_document_id_fkey"
            columns: ["original_document_id"]
            isOneToOne: false
            referencedRelation: "patient_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_billing_fees: {
        Row: {
          created_at: string
          created_by: string | null
          enterprise_id: string
          fee_type: Database["public"]["Enums"]["billing_fee_type"]
          id: string
          is_active: boolean
          name: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enterprise_id: string
          fee_type: Database["public"]["Enums"]["billing_fee_type"]
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enterprise_id?: string
          fee_type?: Database["public"]["Enums"]["billing_fee_type"]
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_billing_fees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_billing_fees_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprises: {
        Row: {
          city: string | null
          cnpj: string | null
          complement: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          name: string
          neighborhood: string | null
          number: string | null
          phone: string | null
          professionals_amount: number
          slug: string
          state: string | null
          street: string | null
          token: string
          whatsapp: string | null
          zipcode: string | null
        }
        Insert: {
          city?: string | null
          cnpj?: string | null
          complement?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          professionals_amount?: number
          slug: string
          state?: string | null
          street?: string | null
          token: string
          whatsapp?: string | null
          zipcode?: string | null
        }
        Update: {
          city?: string | null
          cnpj?: string | null
          complement?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name?: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          professionals_amount?: number
          slug?: string
          state?: string | null
          street?: string | null
          token?: string
          whatsapp?: string | null
          zipcode?: string | null
        }
        Relationships: []
      }
      installments: {
        Row: {
          amount: number
          applied_installment_fees: Json
          billing_id: string
          created_at: string
          due_date: string
          id: string
          installment_number: number
          notes: string | null
          paid_amount: number
          paid_at: string | null
          payment_link: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          splitted_installment: Json
          status: Database["public"]["Enums"]["installment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          applied_installment_fees?: Json
          billing_id: string
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_link?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          splitted_installment?: Json
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          applied_installment_fees?: Json
          billing_id?: string
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_link?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          splitted_installment?: Json
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billings"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_exam_results: {
        Row: {
          created_at: string
          exam_date: string
          exam_name: string
          id: string
          pregnancy_id: string
          result_numeric: number | null
          result_text: string | null
          unit: string | null
        }
        Insert: {
          created_at?: string
          exam_date: string
          exam_name: string
          id?: string
          pregnancy_id: string
          result_numeric?: number | null
          result_text?: string | null
          unit?: string | null
        }
        Update: {
          created_at?: string
          exam_date?: string
          exam_name?: string
          id?: string
          pregnancy_id?: string
          result_numeric?: number | null
          result_text?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_exam_results_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: false
            referencedRelation: "pregnancies"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          error_reason: string | null
          external_message_id: string | null
          id: string
          notification_type: string
          recipient_id: string
          recipient_type: string
          reference_id: string | null
          reference_type: string | null
          status: Database["public"]["Enums"]["notification_log_status"]
          updated_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error_reason?: string | null
          external_message_id?: string | null
          id?: string
          notification_type: string
          recipient_id: string
          recipient_type: string
          reference_id?: string | null
          reference_type?: string | null
          status: Database["public"]["Enums"]["notification_log_status"]
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error_reason?: string | null
          external_message_id?: string | null
          id?: string
          notification_type?: string
          recipient_id?: string
          recipient_type?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["notification_log_status"]
          updated_at?: string
        }
        Relationships: []
      }
      notification_queue_index: {
        Row: {
          created_at: string
          dedup_key: string
          msg_id: number
          notification_type: string
          queue_name: string
          reference_id: string
          reference_type: string
        }
        Insert: {
          created_at?: string
          dedup_key?: string
          msg_id: number
          notification_type: string
          queue_name: string
          reference_id: string
          reference_type: string
        }
        Update: {
          created_at?: string
          dedup_key?: string
          msg_id?: number
          notification_type?: string
          queue_name?: string
          reference_id?: string
          reference_type?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          appointment_cancelled: boolean
          appointment_created: boolean
          appointment_reminder: boolean
          appointment_updated: boolean
          created_at: string
          document_uploaded: boolean
          dpp_approaching: boolean
          evolution_added: boolean
          id: string
          lab_exam_added: boolean
          obstetric_history_updated: boolean
          other_exam_added: boolean
          patient_added: boolean
          pregnancy_evolution_added: boolean
          risk_factors_updated: boolean
          team_invite_accepted: boolean
          team_invite_received: boolean
          team_member_added: boolean
          ultrasound_added: boolean
          updated_at: string
          user_id: string
          vaccine_updated: boolean
          whatsapp_enabled: boolean
        }
        Insert: {
          appointment_cancelled?: boolean
          appointment_created?: boolean
          appointment_reminder?: boolean
          appointment_updated?: boolean
          created_at?: string
          document_uploaded?: boolean
          dpp_approaching?: boolean
          evolution_added?: boolean
          id?: string
          lab_exam_added?: boolean
          obstetric_history_updated?: boolean
          other_exam_added?: boolean
          patient_added?: boolean
          pregnancy_evolution_added?: boolean
          risk_factors_updated?: boolean
          team_invite_accepted?: boolean
          team_invite_received?: boolean
          team_member_added?: boolean
          ultrasound_added?: boolean
          updated_at?: string
          user_id: string
          vaccine_updated?: boolean
          whatsapp_enabled?: boolean
        }
        Update: {
          appointment_cancelled?: boolean
          appointment_created?: boolean
          appointment_reminder?: boolean
          appointment_updated?: boolean
          created_at?: string
          document_uploaded?: boolean
          dpp_approaching?: boolean
          evolution_added?: boolean
          id?: string
          lab_exam_added?: boolean
          obstetric_history_updated?: boolean
          other_exam_added?: boolean
          patient_added?: boolean
          pregnancy_evolution_added?: boolean
          risk_factors_updated?: boolean
          team_invite_accepted?: boolean
          team_invite_received?: boolean
          team_member_added?: boolean
          ultrasound_added?: boolean
          updated_at?: string
          user_id?: string
          vaccine_updated?: boolean
          whatsapp_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          read_at: string | null
          sent_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          read_at?: string | null
          sent_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          read_at?: string | null
          sent_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      other_exams: {
        Row: {
          created_at: string
          description: string
          exam_date: string
          id: string
          pregnancy_id: string
        }
        Insert: {
          created_at?: string
          description: string
          exam_date: string
          id?: string
          pregnancy_id: string
        }
        Update: {
          created_at?: string
          description?: string
          exam_date?: string
          id?: string
          pregnancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "other_exams_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: false
            referencedRelation: "pregnancies"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_documents: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          is_immutable: boolean
          patient_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size: number
          file_type: string
          id?: string
          is_immutable?: boolean
          patient_id: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          is_immutable?: boolean
          patient_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_evolutions: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_public: boolean
          patient_id: string
          professional_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_public?: boolean
          patient_id: string
          professional_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_public?: boolean
          patient_id?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_evolutions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_evolutions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_invite_links: {
        Row: {
          created_at: string | null
          created_by: string
          email: string | null
          enterprise_id: string | null
          expires_at: string
          id: string
          invite_type: string
          metadata: Json
          name: string | null
          patient_id: string | null
          phone: string | null
          status: string
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          email?: string | null
          enterprise_id?: string | null
          expires_at?: string
          id?: string
          invite_type?: string
          metadata?: Json
          name?: string | null
          patient_id?: string | null
          phone?: string | null
          status?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          email?: string | null
          enterprise_id?: string | null
          expires_at?: string
          id?: string
          invite_type?: string
          metadata?: Json
          name?: string | null
          patient_id?: string | null
          phone?: string | null
          status?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_invite_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_invite_links_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_invite_links_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_obstetric_history: {
        Row: {
          breastfeeding_difficulty: boolean | null
          cardiopathy: boolean | null
          created_at: string
          diabetes: boolean | null
          hypertension: boolean | null
          infertility: boolean | null
          other_clinical: boolean | null
          other_clinical_notes: string | null
          other_surgery_notes: string | null
          patient_id: string
          pelvic_uterine_surgery: boolean | null
          prior_surgery: boolean | null
          thromboembolism: boolean | null
          urinary_infection: boolean | null
        }
        Insert: {
          breastfeeding_difficulty?: boolean | null
          cardiopathy?: boolean | null
          created_at?: string
          diabetes?: boolean | null
          hypertension?: boolean | null
          infertility?: boolean | null
          other_clinical?: boolean | null
          other_clinical_notes?: string | null
          other_surgery_notes?: string | null
          patient_id: string
          pelvic_uterine_surgery?: boolean | null
          prior_surgery?: boolean | null
          thromboembolism?: boolean | null
          urinary_infection?: boolean | null
        }
        Update: {
          breastfeeding_difficulty?: boolean | null
          cardiopathy?: boolean | null
          created_at?: string
          diabetes?: boolean | null
          hypertension?: boolean | null
          infertility?: boolean | null
          other_clinical?: boolean | null
          other_clinical_notes?: string | null
          other_surgery_notes?: string | null
          patient_id?: string
          pelvic_uterine_surgery?: boolean | null
          prior_surgery?: boolean | null
          thromboembolism?: boolean | null
          urinary_infection?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_obstetric_history_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          allergies: string[] | null
          blood_type: Database["public"]["Enums"]["blood_type"] | null
          cpf: string | null
          created_at: string | null
          created_by: string
          date_of_birth: string | null
          email: string | null
          family_history_diabetes: boolean | null
          family_history_hypertension: boolean | null
          family_history_others: string | null
          family_history_twin: boolean | null
          height_cm: number | null
          id: string
          marital_status: string | null
          name: string
          occupation: string | null
          partner_name: string | null
          personal_notes: string | null
          phone: string
          rg: string | null
          updated_at: string | null
          user_id: string | null
          whatsapp_enabled: boolean
        }
        Insert: {
          allergies?: string[] | null
          blood_type?: Database["public"]["Enums"]["blood_type"] | null
          cpf?: string | null
          created_at?: string | null
          created_by: string
          date_of_birth?: string | null
          email?: string | null
          family_history_diabetes?: boolean | null
          family_history_hypertension?: boolean | null
          family_history_others?: string | null
          family_history_twin?: boolean | null
          height_cm?: number | null
          id?: string
          marital_status?: string | null
          name: string
          occupation?: string | null
          partner_name?: string | null
          personal_notes?: string | null
          phone: string
          rg?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_enabled?: boolean
        }
        Update: {
          allergies?: string[] | null
          blood_type?: Database["public"]["Enums"]["blood_type"] | null
          cpf?: string | null
          created_at?: string | null
          created_by?: string
          date_of_birth?: string | null
          email?: string | null
          family_history_diabetes?: boolean | null
          family_history_hypertension?: boolean | null
          family_history_others?: string | null
          family_history_twin?: boolean | null
          height_cm?: number | null
          id?: string
          marital_status?: string | null
          name?: string
          occupation?: string | null
          partner_name?: string | null
          personal_notes?: string | null
          phone?: string
          rg?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "patients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          created_at: string
          id: string
          installment_id: string
          notes: string | null
          paid_amount: number
          paid_at: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_path: string | null
          registered_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          installment_id: string
          notes?: string | null
          paid_amount: number
          paid_at: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_path?: string | null
          registered_by: string
        }
        Update: {
          created_at?: string
          id?: string
          installment_id?: string
          notes?: string | null
          paid_amount?: number
          paid_at?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_path?: string | null
          registered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          benefits: string[]
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
          type: Database["public"]["Enums"]["plan_type"]
          value: number | null
        }
        Insert: {
          benefits?: string[]
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          type: Database["public"]["Enums"]["plan_type"]
          value?: number | null
        }
        Update: {
          benefits?: string[]
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          type?: Database["public"]["Enums"]["plan_type"]
          value?: number | null
        }
        Relationships: []
      }
      pregnancies: {
        Row: {
          abortions_count: number | null
          baby_name: string | null
          baby_sex: Database["public"]["Enums"]["baby_sex"] | null
          birth_mode_activated_at: string | null
          birth_mode_activated_by: string | null
          birth_mode_active: boolean
          birth_mode_ended_at: string | null
          birth_weight_grams: number | null
          born_at: string | null
          cesareans_count: number | null
          created_at: string
          created_by: string | null
          deliveries_count: number | null
          delivery_method: Database["public"]["Enums"]["delivery_method"] | null
          due_date: string
          dum: string | null
          enterprise_id: string | null
          gestations_count: number | null
          has_finished: boolean
          id: string
          initial_bmi: number | null
          initial_weight_kg: number | null
          observations: string | null
          patient_id: string
          reference_hospital: string | null
          updated_at: string
        }
        Insert: {
          abortions_count?: number | null
          baby_name?: string | null
          baby_sex?: Database["public"]["Enums"]["baby_sex"] | null
          birth_mode_activated_at?: string | null
          birth_mode_activated_by?: string | null
          birth_mode_active?: boolean
          birth_mode_ended_at?: string | null
          birth_weight_grams?: number | null
          born_at?: string | null
          cesareans_count?: number | null
          created_at?: string
          created_by?: string | null
          deliveries_count?: number | null
          delivery_method?:
            | Database["public"]["Enums"]["delivery_method"]
            | null
          due_date: string
          dum?: string | null
          enterprise_id?: string | null
          gestations_count?: number | null
          has_finished?: boolean
          id?: string
          initial_bmi?: number | null
          initial_weight_kg?: number | null
          observations?: string | null
          patient_id: string
          reference_hospital?: string | null
          updated_at?: string
        }
        Update: {
          abortions_count?: number | null
          baby_name?: string | null
          baby_sex?: Database["public"]["Enums"]["baby_sex"] | null
          birth_mode_activated_at?: string | null
          birth_mode_activated_by?: string | null
          birth_mode_active?: boolean
          birth_mode_ended_at?: string | null
          birth_weight_grams?: number | null
          born_at?: string | null
          cesareans_count?: number | null
          created_at?: string
          created_by?: string | null
          deliveries_count?: number | null
          delivery_method?:
            | Database["public"]["Enums"]["delivery_method"]
            | null
          due_date?: string
          dum?: string | null
          enterprise_id?: string | null
          gestations_count?: number | null
          has_finished?: boolean
          id?: string
          initial_bmi?: number | null
          initial_weight_kg?: number | null
          observations?: string | null
          patient_id?: string
          reference_hospital?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pregnancies_birth_mode_activated_by_fkey"
            columns: ["birth_mode_activated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregnancies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregnancies_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregnancies_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      pregnancy_evolutions: {
        Row: {
          bmi: number | null
          cervical_exam: string | null
          complaint: string | null
          consultation_date: string
          created_at: string
          created_by: string | null
          diastolic_bp: number | null
          edema: boolean | null
          exantema: boolean | null
          exantema_notes: string | null
          fetal_heart_rate: number | null
          fetal_movement: boolean | null
          fetal_presentation:
            | Database["public"]["Enums"]["fetal_presentation"]
            | null
          gestational_days: number | null
          gestational_weeks: number | null
          id: string
          ig_source: string | null
          observations: string | null
          pregnancy_id: string
          systolic_bp: number | null
          uterine_height_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          bmi?: number | null
          cervical_exam?: string | null
          complaint?: string | null
          consultation_date: string
          created_at?: string
          created_by?: string | null
          diastolic_bp?: number | null
          edema?: boolean | null
          exantema?: boolean | null
          exantema_notes?: string | null
          fetal_heart_rate?: number | null
          fetal_movement?: boolean | null
          fetal_presentation?:
            | Database["public"]["Enums"]["fetal_presentation"]
            | null
          gestational_days?: number | null
          gestational_weeks?: number | null
          id?: string
          ig_source?: string | null
          observations?: string | null
          pregnancy_id: string
          systolic_bp?: number | null
          uterine_height_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          bmi?: number | null
          cervical_exam?: string | null
          complaint?: string | null
          consultation_date?: string
          created_at?: string
          created_by?: string | null
          diastolic_bp?: number | null
          edema?: boolean | null
          exantema?: boolean | null
          exantema_notes?: string | null
          fetal_heart_rate?: number | null
          fetal_movement?: boolean | null
          fetal_presentation?:
            | Database["public"]["Enums"]["fetal_presentation"]
            | null
          gestational_days?: number | null
          gestational_weeks?: number | null
          id?: string
          ig_source?: string | null
          observations?: string | null
          pregnancy_id?: string
          systolic_bp?: number | null
          uterine_height_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pregnancy_evolutions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregnancy_evolutions_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: false
            referencedRelation: "pregnancies"
            referencedColumns: ["id"]
          },
        ]
      }
      pregnancy_risk_factors: {
        Row: {
          alcohol: boolean | null
          anemia: boolean | null
          cardiopathy: boolean | null
          cigarettes_per_day: number | null
          created_at: string
          domestic_violence: boolean | null
          exantema: boolean | null
          fever: boolean | null
          gestational_diabetes: boolean | null
          hemorrhage_1st_trimester: boolean | null
          hemorrhage_2nd_trimester: boolean | null
          hemorrhage_3rd_trimester: boolean | null
          hiv_aids: boolean | null
          hypertension: boolean | null
          insulin_use: boolean | null
          isthmocervical_incompetence: boolean | null
          iugr: boolean | null
          oligo_polyhydramnios: boolean | null
          other_drugs: boolean | null
          other_notes: string | null
          post_term: boolean | null
          preeclampsia_eclampsia: boolean | null
          pregnancy_id: string
          premature_membrane_rupture: boolean | null
          preterm_labor_threat: boolean | null
          rh_isoimmunization: boolean | null
          smoking: boolean | null
          syphilis: boolean | null
          toxoplasmosis: boolean | null
          urinary_infection: boolean | null
        }
        Insert: {
          alcohol?: boolean | null
          anemia?: boolean | null
          cardiopathy?: boolean | null
          cigarettes_per_day?: number | null
          created_at?: string
          domestic_violence?: boolean | null
          exantema?: boolean | null
          fever?: boolean | null
          gestational_diabetes?: boolean | null
          hemorrhage_1st_trimester?: boolean | null
          hemorrhage_2nd_trimester?: boolean | null
          hemorrhage_3rd_trimester?: boolean | null
          hiv_aids?: boolean | null
          hypertension?: boolean | null
          insulin_use?: boolean | null
          isthmocervical_incompetence?: boolean | null
          iugr?: boolean | null
          oligo_polyhydramnios?: boolean | null
          other_drugs?: boolean | null
          other_notes?: string | null
          post_term?: boolean | null
          preeclampsia_eclampsia?: boolean | null
          pregnancy_id: string
          premature_membrane_rupture?: boolean | null
          preterm_labor_threat?: boolean | null
          rh_isoimmunization?: boolean | null
          smoking?: boolean | null
          syphilis?: boolean | null
          toxoplasmosis?: boolean | null
          urinary_infection?: boolean | null
        }
        Update: {
          alcohol?: boolean | null
          anemia?: boolean | null
          cardiopathy?: boolean | null
          cigarettes_per_day?: number | null
          created_at?: string
          domestic_violence?: boolean | null
          exantema?: boolean | null
          fever?: boolean | null
          gestational_diabetes?: boolean | null
          hemorrhage_1st_trimester?: boolean | null
          hemorrhage_2nd_trimester?: boolean | null
          hemorrhage_3rd_trimester?: boolean | null
          hiv_aids?: boolean | null
          hypertension?: boolean | null
          insulin_use?: boolean | null
          isthmocervical_incompetence?: boolean | null
          iugr?: boolean | null
          oligo_polyhydramnios?: boolean | null
          other_drugs?: boolean | null
          other_notes?: string | null
          post_term?: boolean | null
          preeclampsia_eclampsia?: boolean | null
          pregnancy_id?: string
          premature_membrane_rupture?: boolean | null
          preterm_labor_threat?: boolean | null
          rh_isoimmunization?: boolean | null
          smoking?: boolean | null
          syphilis?: boolean | null
          toxoplasmosis?: boolean | null
          urinary_infection?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "pregnancy_risk_factors_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: true
            referencedRelation: "pregnancies"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          device_info: Json | null
          fcm_token: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          fcm_token: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          fcm_token?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_invites: {
        Row: {
          completed_at: string | null
          created_at: string
          email: string
          enterprise_id: string
          expired_at: string
          id: string
          invited_by: string
          name: string
          phone: string
          professional_type: Database["public"]["Enums"]["professional_type"]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          email: string
          enterprise_id: string
          expired_at?: string
          id?: string
          invited_by: string
          name: string
          phone: string
          professional_type: Database["public"]["Enums"]["professional_type"]
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          email?: string
          enterprise_id?: string
          expired_at?: string
          id?: string
          invited_by?: string
          name?: string
          phone?: string
          professional_type?: Database["public"]["Enums"]["professional_type"]
        }
        Relationships: [
          {
            foreignKeyName: "registration_invites_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancelation_reason: string | null
          created_at: string
          enterprise_id: string | null
          expires_at: string | null
          frequence: Database["public"]["Enums"]["subscription_frequence"]
          id: string
          paid_at: string | null
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          subscription_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cancelation_reason?: string | null
          created_at?: string
          enterprise_id?: string | null
          expires_at?: string | null
          frequence: Database["public"]["Enums"]["subscription_frequence"]
          id?: string
          paid_at?: string | null
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cancelation_reason?: string | null
          created_at?: string
          enterprise_id?: string | null
          expires_at?: string | null
          frequence?: Database["public"]["Enums"]["subscription_frequence"]
          id?: string
          paid_at?: string | null
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          invited_by: string
          invited_professional_id: string | null
          patient_id: string
          professional_type:
            | Database["public"]["Enums"]["professional_type"]
            | null
          status: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          invited_by: string
          invited_professional_id?: string | null
          patient_id: string
          professional_type?:
            | Database["public"]["Enums"]["professional_type"]
            | null
          status?: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          invited_by?: string
          invited_professional_id?: string | null
          patient_id?: string
          professional_type?:
            | Database["public"]["Enums"]["professional_type"]
            | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invites_invited_professional_id_fkey"
            columns: ["invited_professional_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invites_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          is_backup: boolean | null
          joined_at: string | null
          patient_id: string
          pregnancy_id: string
          professional_id: string
          professional_type: Database["public"]["Enums"]["professional_type"]
        }
        Insert: {
          id?: string
          is_backup?: boolean | null
          joined_at?: string | null
          patient_id: string
          pregnancy_id: string
          professional_id: string
          professional_type: Database["public"]["Enums"]["professional_type"]
        }
        Update: {
          id?: string
          is_backup?: boolean | null
          joined_at?: string | null
          patient_id?: string
          pregnancy_id?: string
          professional_id?: string
          professional_type?: Database["public"]["Enums"]["professional_type"]
        }
        Relationships: [
          {
            foreignKeyName: "team_members_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: false
            referencedRelation: "pregnancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ultrasounds: {
        Row: {
          amniotic_fluid_index:
            | Database["public"]["Enums"]["amniotic_fluid_index"]
            | null
          ccn_mm: number | null
          cervical_length_cm: number | null
          created_at: string
          doppler_result: Database["public"]["Enums"]["doppler_result"] | null
          estimated_weight_g: number | null
          exam_date: string
          fetal_heart_rate_bpm: number | null
          gestational_days: number | null
          gestational_weeks: number | null
          id: string
          iugr: boolean | null
          nasal_bone_present: boolean | null
          notes: string | null
          nuchal_translucency_mm: number | null
          placenta_position: string | null
          pregnancy_id: string
        }
        Insert: {
          amniotic_fluid_index?:
            | Database["public"]["Enums"]["amniotic_fluid_index"]
            | null
          ccn_mm?: number | null
          cervical_length_cm?: number | null
          created_at?: string
          doppler_result?: Database["public"]["Enums"]["doppler_result"] | null
          estimated_weight_g?: number | null
          exam_date: string
          fetal_heart_rate_bpm?: number | null
          gestational_days?: number | null
          gestational_weeks?: number | null
          id?: string
          iugr?: boolean | null
          nasal_bone_present?: boolean | null
          notes?: string | null
          nuchal_translucency_mm?: number | null
          placenta_position?: string | null
          pregnancy_id: string
        }
        Update: {
          amniotic_fluid_index?:
            | Database["public"]["Enums"]["amniotic_fluid_index"]
            | null
          ccn_mm?: number | null
          cervical_length_cm?: number | null
          created_at?: string
          doppler_result?: Database["public"]["Enums"]["doppler_result"] | null
          estimated_weight_g?: number | null
          exam_date?: string
          fetal_heart_rate_bpm?: number | null
          gestational_days?: number | null
          gestational_weeks?: number | null
          id?: string
          iugr?: boolean | null
          nasal_bone_present?: boolean | null
          notes?: string | null
          nuchal_translucency_mm?: number | null
          placenta_position?: string | null
          pregnancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultrasounds_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: false
            referencedRelation: "pregnancies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_enterprises: {
        Row: {
          enterprise_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          enterprise_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          enterprise_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_enterprises_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_enterprises_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_google_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          id: string
          refresh_token: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_google_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          personal_documents: Json | null
          phone: string | null
          professional_documents: Json | null
          professional_type:
            | Database["public"]["Enums"]["professional_type"]
            | null
          updated_at: string | null
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id: string
          name: string
          personal_documents?: Json | null
          phone?: string | null
          professional_documents?: Json | null
          professional_type?:
            | Database["public"]["Enums"]["professional_type"]
            | null
          updated_at?: string | null
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          personal_documents?: Json | null
          phone?: string | null
          professional_documents?: Json | null
          professional_type?:
            | Database["public"]["Enums"]["professional_type"]
            | null
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: []
      }
      vaccine_records: {
        Row: {
          applied_date: string | null
          created_at: string
          dose_number: number | null
          id: string
          notes: string | null
          pregnancy_id: string
          status: string | null
          vaccine_name: Database["public"]["Enums"]["vaccine_name"]
        }
        Insert: {
          applied_date?: string | null
          created_at?: string
          dose_number?: number | null
          id?: string
          notes?: string | null
          pregnancy_id: string
          status?: string | null
          vaccine_name: Database["public"]["Enums"]["vaccine_name"]
        }
        Update: {
          applied_date?: string | null
          created_at?: string
          dose_number?: number | null
          id?: string
          notes?: string | null
          pregnancy_id?: string
          status?: string | null
          vaccine_name?: Database["public"]["Enums"]["vaccine_name"]
        }
        Relationships: [
          {
            foreignKeyName: "vaccine_records_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: false
            referencedRelation: "pregnancies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ack_notification: {
        Args: { p_msg_id: number; p_queue_name: string }
        Returns: boolean
      }
      call_send_notification: { Args: { p_payload: Json }; Returns: undefined }
      cancel_notifications_for_reference: {
        Args: { p_reference_id: string; p_reference_type: string }
        Returns: number
      }
      dead_letter_notification: {
        Args: {
          p_channel: Database["public"]["Enums"]["notification_channel"]
          p_msg_id: number
          p_notification_type: string
          p_queue_name: string
          p_reason: string
          p_recipient_id: string
          p_recipient_type: string
          p_reference_id: string
          p_reference_type: string
        }
        Returns: undefined
      }
      dequeue_notifications: {
        Args: { p_qty?: number; p_queue_name: string; p_vt?: number }
        Returns: {
          enqueued_at: string
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      enqueue_notification: {
        Args: {
          p_dedup_key?: string
          p_delay_seconds?: number
          p_notification_type: string
          p_queue_name: string
          p_recipient_id: string
          p_recipient_type: string
          p_reference_id: string
          p_reference_type: string
        }
        Returns: number
      }
      gestational_weeks: { Args: { dum: string }; Returns: number }
      get_filtered_patients: {
        Args: {
          filter_type?: string
          page_limit?: number
          page_offset?: number
          patient_ids: string[]
          search_query?: string
        }
        Returns: {
          address: Json
          born_at: string
          created_at: string
          created_by: string
          date_of_birth: string
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          due_date: string
          dum: string
          email: string
          has_finished: boolean
          id: string
          name: string
          observations: string
          phone: string
          total_count: number
          updated_at: string
          user_id: string
        }[]
      }
      get_paginated_enterprises: {
        Args: { page?: number; size?: number }
        Returns: Json
      }
      get_paginated_plans: {
        Args: { page?: number; size?: number }
        Returns: Json
      }
      get_paginated_subscriptions: {
        Args: { page?: number; size?: number }
        Returns: Json
      }
      get_paginated_users: {
        Args: { page?: number; size?: number }
        Returns: Json
      }
      get_staff_enterprise_ids: { Args: never; Returns: string[] }
      is_enterprise_patient: {
        Args: { p_patient_id: string }
        Returns: boolean
      }
      is_enterprise_staff: { Args: never; Returns: boolean }
      is_professional: { Args: never; Returns: boolean }
      is_same_enterprise: { Args: { p_user_id: string }; Returns: boolean }
      is_team_member: { Args: { p_patient_id: string }; Returns: boolean }
      mark_overdue_installments_and_billings: {
        Args: never
        Returns: undefined
      }
      notification_queue_length: {
        Args: { p_queue_name: string }
        Returns: number
      }
      process_notification_queues: { Args: never; Returns: undefined }
      requeue_with_backoff: {
        Args: { p_msg_id: number; p_queue_name: string; p_read_ct: number }
        Returns: undefined
      }
      schedule_appointment_unconfirmed: { Args: never; Returns: undefined }
      schedule_contract_pending_signature: { Args: never; Returns: undefined }
      schedule_daily_agenda_summary: { Args: never; Returns: undefined }
      schedule_dpp_passed_no_birth_record: { Args: never; Returns: undefined }
      schedule_dpp_reminders: { Args: never; Returns: undefined }
      schedule_installment_overdue_professional: {
        Args: never
        Returns: undefined
      }
      schedule_installment_reminders: { Args: never; Returns: undefined }
      schedule_installment_under_review_stalled: {
        Args: never
        Returns: undefined
      }
      schedule_monthly_billing_report: { Args: never; Returns: undefined }
      schedule_prenatal_followup_gap: { Args: never; Returns: undefined }
      schedule_subscription_billing_issue: { Args: never; Returns: undefined }
      schedule_team_invite_pending: { Args: never; Returns: undefined }
    }
    Enums: {
      amniotic_fluid_index:
        | "severe_oligohydramnios"
        | "oligohydramnios"
        | "normal"
        | "polyhydramnios"
      appointment_status: "agendada" | "realizada" | "cancelada"
      appointment_type: "consulta" | "encontro" | "exame"
      baby_sex: "masculino" | "feminino"
      billing_fee_type: "fixed" | "percentage"
      billing_status: "pendente" | "pago" | "atrasado" | "cancelado"
      birth_amniotic_fluid_type:
        | "intacto"
        | "com_sangue"
        | "claro"
        | "com_meconio"
      birth_contraction_effectiveness:
        | "efetiva"
        | "intermediaria"
        | "nao_efetiva"
      birth_medication_type:
        | "fluidos_intravenosos"
        | "ocitocina"
        | "analgesia"
        | "outros"
      blood_type: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-"
      delivery_method: "cesarean" | "vaginal" | "vaginal_assisted"
      doppler_result: "normal" | "abnormal" | "not_performed"
      fetal_presentation: "cephalic" | "pelvic" | "transverse"
      installment_status:
        | "pendente"
        | "pago"
        | "atrasado"
        | "cancelado"
        | "em_analise"
      notification_channel: "push" | "whatsapp" | "email"
      notification_log_status:
        | "sent"
        | "delivered"
        | "read"
        | "failed"
        | "dead_letter"
      notification_type:
        | "appointment_created"
        | "appointment_updated"
        | "appointment_cancelled"
        | "appointment_reminder"
        | "team_invite_received"
        | "team_invite_accepted"
        | "document_uploaded"
        | "evolution_added"
        | "dpp_approaching"
        | "billing_created"
        | "billing_payment_received"
        | "billing_reminder"
        | "patient_added"
        | "team_member_added"
        | "obstetric_history_updated"
        | "risk_factors_updated"
        | "pregnancy_evolution_added"
        | "lab_exam_added"
        | "other_exam_added"
        | "ultrasound_added"
        | "vaccine_updated"
        | "contract_ready_for_signature"
        | "contract_change_requested"
        | "contract_fully_signed"
      payment_method:
        | "credito"
        | "debito"
        | "pix"
        | "boleto"
        | "dinheiro"
        | "outro"
      plan_type: "free" | "premium" | "enterprise"
      professional_type: "obstetra" | "enfermeiro" | "doula" | "fisio"
      subscription_frequence: "month" | "quarter" | "semester" | "year"
      subscription_status:
        | "active"
        | "pending"
        | "canceling"
        | "canceled"
        | "expired"
        | "failed"
        | "replaced"
      user_type: "professional" | "patient" | "manager" | "secretary" | "admin"
      vaccine_name:
        | "covid"
        | "influenza"
        | "hepatitis_b"
        | "dtpa"
        | "abrysvo"
        | "rhogam"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      amniotic_fluid_index: [
        "severe_oligohydramnios",
        "oligohydramnios",
        "normal",
        "polyhydramnios",
      ],
      appointment_status: ["agendada", "realizada", "cancelada"],
      appointment_type: ["consulta", "encontro", "exame"],
      baby_sex: ["masculino", "feminino"],
      billing_fee_type: ["fixed", "percentage"],
      billing_status: ["pendente", "pago", "atrasado", "cancelado"],
      birth_amniotic_fluid_type: [
        "intacto",
        "com_sangue",
        "claro",
        "com_meconio",
      ],
      birth_contraction_effectiveness: [
        "efetiva",
        "intermediaria",
        "nao_efetiva",
      ],
      birth_medication_type: [
        "fluidos_intravenosos",
        "ocitocina",
        "analgesia",
        "outros",
      ],
      blood_type: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      delivery_method: ["cesarean", "vaginal", "vaginal_assisted"],
      doppler_result: ["normal", "abnormal", "not_performed"],
      fetal_presentation: ["cephalic", "pelvic", "transverse"],
      installment_status: [
        "pendente",
        "pago",
        "atrasado",
        "cancelado",
        "em_analise",
      ],
      notification_channel: ["push", "whatsapp", "email"],
      notification_log_status: [
        "sent",
        "delivered",
        "read",
        "failed",
        "dead_letter",
      ],
      notification_type: [
        "appointment_created",
        "appointment_updated",
        "appointment_cancelled",
        "appointment_reminder",
        "team_invite_received",
        "team_invite_accepted",
        "document_uploaded",
        "evolution_added",
        "dpp_approaching",
        "billing_created",
        "billing_payment_received",
        "billing_reminder",
        "patient_added",
        "team_member_added",
        "obstetric_history_updated",
        "risk_factors_updated",
        "pregnancy_evolution_added",
        "lab_exam_added",
        "other_exam_added",
        "ultrasound_added",
        "vaccine_updated",
        "contract_ready_for_signature",
        "contract_change_requested",
        "contract_fully_signed",
      ],
      payment_method: [
        "credito",
        "debito",
        "pix",
        "boleto",
        "dinheiro",
        "outro",
      ],
      plan_type: ["free", "premium", "enterprise"],
      professional_type: ["obstetra", "enfermeiro", "doula", "fisio"],
      subscription_frequence: ["month", "quarter", "semester", "year"],
      subscription_status: [
        "active",
        "pending",
        "canceling",
        "canceled",
        "expired",
        "failed",
        "replaced",
      ],
      user_type: ["professional", "patient", "manager", "secretary", "admin"],
      vaccine_name: [
        "covid",
        "influenza",
        "hepatitis_b",
        "dtpa",
        "abrysvo",
        "rhogam",
      ],
    },
  },
} as const
