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
      appointments: {
        Row: {
          created_at: string | null
          date: string
          duration: number | null
          id: string
          location: string | null
          notes: string | null
          patient_id: string
          professional_id: string
          status: Database["public"]["Enums"]["appointment_status"]
          time: string
          type: Database["public"]["Enums"]["appointment_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          duration?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          patient_id: string
          professional_id: string
          status?: Database["public"]["Enums"]["appointment_status"]
          time: string
          type: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          duration?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          patient_id?: string
          professional_id?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          time?: string
          type?: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string | null
        }
        Relationships: [
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
          created_at: string
          description: string
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
          created_at?: string
          description: string
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
          created_at?: string
          description?: string
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
            foreignKeyName: "billings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
      installments_scheduled_notifications: {
        Row: {
          created_at: string
          id: string
          installment_id: string
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["installments_notification_status"]
          type: Database["public"]["Enums"]["installments_notification_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          installment_id: string
          scheduled_for: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["installments_notification_status"]
          type: Database["public"]["Enums"]["installments_notification_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          installment_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["installments_notification_status"]
          type?: Database["public"]["Enums"]["installments_notification_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_scheduled_notifications_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_scheduled_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_exam_results: {
        Row: {
          created_at: string
          exam_date: string
          exam_name: string
          hemoglobin_electrophoresis:
            | Database["public"]["Enums"]["hemoglobin_electrophoresis_result"]
            | null
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
          hemoglobin_electrophoresis?:
            | Database["public"]["Enums"]["hemoglobin_electrophoresis_result"]
            | null
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
          hemoglobin_electrophoresis?:
            | Database["public"]["Enums"]["hemoglobin_electrophoresis_result"]
            | null
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
          team_invite_accepted: boolean
          team_invite_received: boolean
          updated_at: string
          user_id: string
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
          team_invite_accepted?: boolean
          team_invite_received?: boolean
          updated_at?: string
          user_id: string
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
          team_invite_accepted?: boolean
          team_invite_received?: boolean
          updated_at?: string
          user_id?: string
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
          patient_id: string
          professional_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          patient_id: string
          professional_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
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
          expires_at: string
          id: string
          patient_id: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          expires_at: string
          id?: string
          patient_id?: string | null
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          expires_at?: string
          id?: string
          patient_id?: string | null
          token?: string
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
          city: string | null
          complement: string | null
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
          name: string
          neighborhood: string | null
          number: string | null
          partner_name: string | null
          personal_notes: string | null
          phone: string
          state: string | null
          street: string | null
          updated_at: string | null
          user_id: string | null
          zipcode: string | null
        }
        Insert: {
          allergies?: string[] | null
          blood_type?: Database["public"]["Enums"]["blood_type"] | null
          city?: string | null
          complement?: string | null
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
          name: string
          neighborhood?: string | null
          number?: string | null
          partner_name?: string | null
          personal_notes?: string | null
          phone: string
          state?: string | null
          street?: string | null
          updated_at?: string | null
          user_id?: string | null
          zipcode?: string | null
        }
        Update: {
          allergies?: string[] | null
          blood_type?: Database["public"]["Enums"]["blood_type"] | null
          city?: string | null
          complement?: string | null
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
          name?: string
          neighborhood?: string | null
          number?: string | null
          partner_name?: string | null
          personal_notes?: string | null
          phone?: string
          state?: string | null
          street?: string | null
          updated_at?: string | null
          user_id?: string | null
          zipcode?: string | null
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
          born_at: string | null
          cesareans_count: number | null
          created_at: string
          created_by: string | null
          deliveries_count: number | null
          delivery_method: Database["public"]["Enums"]["delivery_method"] | null
          due_date: string
          dum: string | null
          gestations_count: number | null
          has_finished: boolean
          id: string
          initial_bmi: number | null
          initial_weight_kg: number | null
          observations: string | null
          patient_id: string
          updated_at: string
        }
        Insert: {
          abortions_count?: number | null
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
          gestations_count?: number | null
          has_finished?: boolean
          id?: string
          initial_bmi?: number | null
          initial_weight_kg?: number | null
          observations?: string | null
          patient_id: string
          updated_at?: string
        }
        Update: {
          abortions_count?: number | null
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
          gestations_count?: number | null
          has_finished?: boolean
          id?: string
          initial_bmi?: number | null
          initial_weight_kg?: number | null
          observations?: string | null
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pregnancies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
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
          responsible: string | null
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
          responsible?: string | null
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
          responsible?: string | null
          systolic_bp?: number | null
          uterine_height_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
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
      scheduled_notifications: {
        Row: {
          created_at: string
          id: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          payload: Json | null
          processed_at: string | null
          reference_id: string
          reference_type: string
          scheduled_for: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          payload?: Json | null
          processed_at?: string | null
          reference_id: string
          reference_type: string
          scheduled_for: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_type?: Database["public"]["Enums"]["notification_type"]
          payload?: Json | null
          processed_at?: string | null
          reference_id?: string
          reference_type?: string
          scheduled_for?: string
        }
        Relationships: []
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
          pregnancy_id: string | null
          professional_id: string
          professional_type: Database["public"]["Enums"]["professional_type"]
        }
        Insert: {
          id?: string
          is_backup?: boolean | null
          joined_at?: string | null
          patient_id: string
          pregnancy_id?: string | null
          professional_id: string
          professional_type: Database["public"]["Enums"]["professional_type"]
        }
        Update: {
          id?: string
          is_backup?: boolean | null
          joined_at?: string | null
          patient_id?: string
          pregnancy_id?: string | null
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
          amniotic_fluid_index: Database["public"]["Enums"]["amniotic_fluid_index"] | null
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
          amniotic_fluid_index?: Database["public"]["Enums"]["amniotic_fluid_index"] | null
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
          amniotic_fluid_index?: Database["public"]["Enums"]["amniotic_fluid_index"] | null
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
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          enterprise_id: string | null
          id: string
          name: string
          phone: string | null
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
          enterprise_id?: string | null
          id: string
          name: string
          phone?: string | null
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
          enterprise_id?: string | null
          id?: string
          name?: string
          phone?: string | null
          professional_type?:
            | Database["public"]["Enums"]["professional_type"]
            | null
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: [
          {
            foreignKeyName: "users_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
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
          city: string
          complement: string
          created_at: string
          created_by: string
          date_of_birth: string
          due_date: string
          dum: string
          email: string
          id: string
          name: string
          neighborhood: string
          number: string
          observations: string
          phone: string
          state: string
          street: string
          total_count: number
          updated_at: string
          user_id: string
          zipcode: string
        }[]
      }
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
      process_scheduled_notifications: { Args: never; Returns: undefined }
      schedule_dpp_reminders: { Args: never; Returns: undefined }
    }
    Enums: {
      amniotic_fluid_index: "severe_oligohydramnios" | "oligohydramnios" | "normal" | "polyhydramnios"
      appointment_status: "agendada" | "realizada" | "cancelada"
      appointment_type: "consulta" | "encontro"
      billing_status: "pendente" | "pago" | "atrasado" | "cancelado"
      blood_type: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-"
      delivery_method: "cesarean" | "vaginal"
      doppler_result: "normal" | "abnormal" | "not_performed"
      fetal_presentation: "cephalic" | "pelvic" | "transverse"
      hemoglobin_electrophoresis_result:
        | "AA"
        | "AS"
        | "AC"
        | "SS"
        | "SC"
        | "other_heterozygous"
        | "other_homozygous"
      installment_status: "pendente" | "pago" | "atrasado" | "cancelado"
      installments_notification_status:
        | "pending"
        | "sent"
        | "cancelled"
        | "failed"
      installments_notification_type:
        | "due_in_7_days"
        | "due_in_3_days"
        | "due_today"
        | "overdue"
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
      payment_method:
        | "credito"
        | "debito"
        | "pix"
        | "boleto"
        | "dinheiro"
        | "outro"
      plan_type: "free" | "premium" | "enterprise"
      professional_type: "obstetra" | "enfermeiro" | "doula"
      subscription_frequence: "month" | "quarter" | "semester" | "year"
      subscription_status:
        | "active"
        | "pending"
        | "canceling"
        | "canceled"
        | "expired"
        | "failed"
        | "replaced"
      user_type: "professional" | "patient" | "manager" | "secretary"
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
      appointment_status: ["agendada", "realizada", "cancelada"],
      appointment_type: ["consulta", "encontro"],
      billing_status: ["pendente", "pago", "atrasado", "cancelado"],
      blood_type: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      delivery_method: ["cesarean", "vaginal"],
      doppler_result: ["normal", "abnormal", "not_performed"],
      fetal_presentation: ["cephalic", "pelvic", "transverse"],
      hemoglobin_electrophoresis_result: [
        "AA",
        "AS",
        "AC",
        "SS",
        "SC",
        "other_heterozygous",
        "other_homozygous",
      ],
      installment_status: ["pendente", "pago", "atrasado", "cancelado"],
      installments_notification_status: [
        "pending",
        "sent",
        "cancelled",
        "failed",
      ],
      installments_notification_type: [
        "due_in_7_days",
        "due_in_3_days",
        "due_today",
        "overdue",
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
      professional_type: ["obstetra", "enfermeiro", "doula"],
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
      user_type: ["professional", "patient", "manager", "secretary"],
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
