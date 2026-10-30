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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      budgets: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          id: string
          month: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          id?: string
          month: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          id?: string
          month?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      categories: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          icon: string
          id: string
          name: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          archived_at?: string | null
          color: string
          created_at?: string
          icon: string
          id?: string
          name: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      goal_contributions: {
        Row: {
          amount: number
          created_at: string
          goal_id: string
          id: string
          note: string | null
          occurred_on: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          goal_id: string
          id?: string
          note?: string | null
          occurred_on: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          goal_id?: string
          id?: string
          note?: string | null
          occurred_on?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_goal_id_workspace_id_fkey"
            columns: ["goal_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id", "workspace_id"]
          }
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          currency: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          currency?: string
          full_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          currency?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          day_of_month: number
          ends_on: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          id: string
          is_active: boolean
          month_of_year: number | null
          name: string
          starts_on: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          day_of_month: number
          ends_on?: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          is_active?: boolean
          month_of_year?: number | null
          name: string
          starts_on: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          day_of_month?: number
          ends_on?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          is_active?: boolean
          month_of_year?: number | null
          name?: string
          starts_on?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      savings_goals: {
        Row: {
          color: string
          completed_at: string | null
          created_at: string
          icon: string
          id: string
          name: string
          status: Database["public"]["Enums"]["goal_status"]
          target_amount: number
          target_date: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color: string
          completed_at?: string | null
          created_at?: string
          icon: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount: number
          target_date?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string
          completed_at?: string | null
          created_at?: string
          icon?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number
          target_date?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          description: string
          id: string
          note: string | null
          occurred_on: string
          recurring_due_on: string | null
          recurring_expense_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          description: string
          id?: string
          note?: string | null
          occurred_on: string
          recurring_due_on?: string | null
          recurring_expense_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          description?: string
          id?: string
          note?: string | null
          occurred_on?: string
          recurring_due_on?: string | null
          recurring_expense_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_expense_id_fkey"
            columns: ["recurring_expense_id"]
            isOneToOne: false
            referencedRelation: "recurring_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          type: Database["public"]["Enums"]["workspace_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          type: Database["public"]["Enums"]["workspace_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          type?: Database["public"]["Enums"]["workspace_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      budget_progress: {
        Args: { p_month: string; p_workspace_id: string }
        Returns: {
          archived: boolean
          budget_amount: number
          budget_id: string
          category_id: string
          color: string
          committed: number
          icon: string
          name: string
          spent: number
        }[]
      }
      category_totals: {
        Args: {
          p_from: string
          p_to: string
          p_type: Database["public"]["Enums"]["transaction_type"]
          p_workspace_id: string
        }
        Returns: {
          archived: boolean
          category_id: string
          color: string
          icon: string
          name: string
          total: number
          tx_count: number
        }[]
      }
      goal_progress: {
        Args: { p_workspace_id: string }
        Returns: {
          color: string
          completed_at: string
          contributions_count: number
          created_at: string
          icon: string
          id: string
          name: string
          saved: number
          status: Database["public"]["Enums"]["goal_status"]
          target_amount: number
          target_date: string
        }[]
      }
      is_workspace_owner: { Args: { p_workspace_id: string }; Returns: boolean }
      monthly_totals: {
        Args: { p_from: string; p_to: string; p_workspace_id: string }
        Returns: {
          expense: number
          income: number
          month: string
          tx_count: number
        }[]
      }
      recurring_occurrences: {
        Args: { p_from: string; p_to: string; p_workspace_id: string }
        Returns: {
          amount: number
          category_id: string
          due_on: string
          name: string
          paid_amount: number
          recurring_expense_id: string
          transaction_id: string
        }[]
      }
      transaction_totals: {
        Args: {
          p_category_id?: string
          p_from?: string
          p_search?: string
          p_to?: string
          p_type?: Database["public"]["Enums"]["transaction_type"]
          p_workspace_id: string
        }
        Returns: {
          expense: number
          income: number
        }[]
      }
      workspace_balance: { Args: { p_workspace_id: string }; Returns: number }
    }
    Enums: {
      goal_status: "active" | "completed" | "archived"
      recurring_frequency: "monthly" | "yearly"
      transaction_type: "income" | "expense"
      workspace_type: "personal" | "business"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never
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
      goal_status: ["active", "completed", "archived"],
      recurring_frequency: ["monthly", "yearly"],
      transaction_type: ["income", "expense"],
      workspace_type: ["personal", "business"]
    }
  }
} as const
