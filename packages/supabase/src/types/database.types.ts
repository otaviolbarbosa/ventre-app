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
          installment_interval: number
          notes: string | null
          paid_amount: number
          patient_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          professional_id: string
          status: Database["public"]["Enums"]["billing_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          installment_count?: number
          installment_interval?: number
          notes?: string | null
          paid_amount?: number
          patient_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          professional_id: string
          status?: Database["public"]["Enums"]["billing_status"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          installment_count?: number
          installment_interval?: number
          notes?: string | null
          paid_amount?: number
          patient_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          professional_id?: string
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
          {
            foreignKeyName: "billings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      patients: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: string
          date_of_birth: string
          due_date: string
          dum: string | null
          email: string
          id: string
          name: string
          observations: string | null
          phone: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by: string
          date_of_birth: string
          due_date: string
          dum?: string | null
          email: string
          id?: string
          name: string
          observations?: string | null
          phone: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by?: string
          date_of_birth?: string
          due_date?: string
          dum?: string | null
          email?: string
          id?: string
          name?: string
          observations?: string | null
          phone?: string
          updated_at?: string | null
          user_id?: string | null
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
      team_invites: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          invited_by: string
          invited_professional_id: string
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
          invited_professional_id: string
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
          invited_professional_id?: string
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
          joined_at: string | null
          patient_id: string
          professional_id: string
          professional_type: Database["public"]["Enums"]["professional_type"]
        }
        Insert: {
          id?: string
          joined_at?: string | null
          patient_id: string
          professional_id: string
          professional_type: Database["public"]["Enums"]["professional_type"]
        }
        Update: {
          id?: string
          joined_at?: string | null
          patient_id?: string
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
            foreignKeyName: "team_members_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
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
          id?: string
          name?: string
          phone?: string | null
          professional_type?:
            | Database["public"]["Enums"]["professional_type"]
            | null
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: []
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
          address: string
          created_at: string
          created_by: string
          date_of_birth: string
          due_date: string
          dum: string
          email: string
          id: string
          name: string
          observations: string
          phone: string
          total_count: number
          updated_at: string
          user_id: string
        }[]
      }
      is_professional: { Args: never; Returns: boolean }
      is_team_member: { Args: { p_patient_id: string }; Returns: boolean }
      process_scheduled_notifications: { Args: never; Returns: undefined }
      schedule_dpp_reminders: { Args: never; Returns: undefined }
    }
    Enums: {
      appointment_status: "agendada" | "realizada" | "cancelada"
      appointment_type: "consulta" | "encontro"
      billing_status: "pendente" | "pago" | "atrasado" | "cancelado"
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
      professional_type: "obstetra" | "enfermeiro" | "doula"
      user_type: "professional" | "patient"
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
      professional_type: ["obstetra", "enfermeiro", "doula"],
      user_type: ["professional", "patient"],
    },
  },
} as const
