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
      account_adjustments: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          id: string
          note: string | null
          occurred_on: string
          workspace_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          occurred_on: string
          workspace_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          occurred_on?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_adjustments_account_id_workspace_id_fkey"
            columns: ["account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "workspace_id"]
          }
        ]
      }
      accounts: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          icon: string
          id: string
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          opening_balance: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          color: string
          created_at?: string
          icon: string
          id?: string
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          opening_balance?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          icon?: string
          id?: string
          kind?: Database["public"]["Enums"]["account_kind"]
          name?: string
          opening_balance?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
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
      business_profiles: {
        Row: {
          created_at: string
          sector: string
          tax_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          sector: string
          tax_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          sector?: string
          tax_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
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
          scope: Database["public"]["Enums"]["workspace_type"]
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
          scope?: Database["public"]["Enums"]["workspace_type"]
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
          scope?: Database["public"]["Enums"]["workspace_type"]
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
      debt_entries: {
        Row: {
          amount: number
          created_at: string
          debt_id: string
          id: string
          import_id: string | null
          kind: Database["public"]["Enums"]["debt_entry_kind"]
          note: string | null
          occurred_on: string
          transaction_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          debt_id: string
          id?: string
          import_id?: string | null
          kind: Database["public"]["Enums"]["debt_entry_kind"]
          note?: string | null
          occurred_on: string
          transaction_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          debt_id?: string
          id?: string
          import_id?: string | null
          kind?: Database["public"]["Enums"]["debt_entry_kind"]
          note?: string | null
          occurred_on?: string
          transaction_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_entries_debt_id_workspace_id_fkey"
            columns: ["debt_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "debt_entries_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          }
        ]
      }
      debts: {
        Row: {
          closed_at: string | null
          closing_day: number | null
          counterparty: string | null
          created_at: string
          credit_limit: number | null
          due_day: number | null
          expected_on: string | null
          id: string
          installment: number | null
          interest_rate: number | null
          kind: Database["public"]["Enums"]["debt_kind"]
          min_payment: number | null
          name: string
          opening_balance: number
          original_amount: number | null
          rate_type: Database["public"]["Enums"]["rate_type"] | null
          status: Database["public"]["Enums"]["debt_status"]
          term_months: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          closed_at?: string | null
          closing_day?: number | null
          counterparty?: string | null
          created_at?: string
          credit_limit?: number | null
          due_day?: number | null
          expected_on?: string | null
          id?: string
          installment?: number | null
          interest_rate?: number | null
          kind: Database["public"]["Enums"]["debt_kind"]
          min_payment?: number | null
          name: string
          opening_balance: number
          original_amount?: number | null
          rate_type?: Database["public"]["Enums"]["rate_type"] | null
          status?: Database["public"]["Enums"]["debt_status"]
          term_months?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          closed_at?: string | null
          closing_day?: number | null
          counterparty?: string | null
          created_at?: string
          credit_limit?: number | null
          due_day?: number | null
          expected_on?: string | null
          id?: string
          installment?: number | null
          interest_rate?: number | null
          kind?: Database["public"]["Enums"]["debt_kind"]
          min_payment?: number | null
          name?: string
          opening_balance?: number
          original_amount?: number | null
          rate_type?: Database["public"]["Enums"]["rate_type"] | null
          status?: Database["public"]["Enums"]["debt_status"]
          term_months?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      dismissed_recommendations: {
        Row: {
          created_at: string
          entity_key: string
          id: string
          month: string
          rule: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          entity_key: string
          id?: string
          month: string
          rule: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          entity_key?: string
          id?: string
          month?: string
          rule?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dismissed_recommendations_workspace_id_fkey"
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
          import_id: string | null
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
          import_id?: string | null
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
          import_id?: string | null
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
          },
          {
            foreignKeyName: "goal_contributions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          }
        ]
      }
      imports: {
        Row: {
          created_at: string
          filename: string
          id: string
          sheets: string[]
          stats: Json
          status: Database["public"]["Enums"]["import_status"]
          target: Database["public"]["Enums"]["import_target"]
          undone_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          sheets?: string[]
          stats: Json
          status?: Database["public"]["Enums"]["import_status"]
          target?: Database["public"]["Enums"]["import_target"]
          undone_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          sheets?: string[]
          stats?: Json
          status?: Database["public"]["Enums"]["import_status"]
          target?: Database["public"]["Enums"]["import_target"]
          undone_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "imports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
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
          import_id: string | null
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
          import_id?: string | null
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
          import_id?: string | null
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
            foreignKeyName: "recurring_expenses_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
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
          account_id: string | null
          amount: number
          category_id: string
          counterparty: string | null
          created_at: string
          description: string
          id: string
          import_id: string | null
          invoice_ref: string | null
          note: string | null
          occurred_on: string
          recurring_due_on: string | null
          recurring_expense_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id: string
          counterparty?: string | null
          created_at?: string
          description: string
          id?: string
          import_id?: string | null
          invoice_ref?: string | null
          note?: string | null
          occurred_on: string
          recurring_due_on?: string | null
          recurring_expense_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string
          counterparty?: string | null
          created_at?: string
          description?: string
          id?: string
          import_id?: string | null
          invoice_ref?: string | null
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
            foreignKeyName: "transactions_account_id_workspace_id_fkey"
            columns: ["account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
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
      transfers: {
        Row: {
          amount: number
          created_at: string
          from_account_id: string
          id: string
          note: string | null
          occurred_on: string
          to_account_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_account_id: string
          id?: string
          note?: string | null
          occurred_on: string
          to_account_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_account_id?: string
          id?: string
          note?: string | null
          occurred_on?: string
          to_account_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_account_id_workspace_id_fkey"
            columns: ["from_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_workspace_id_fkey"
            columns: ["to_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "workspace_id"]
          }
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          deletion_requested_at: string | null
          id: string
          name: string
          owner_id: string
          type: Database["public"]["Enums"]["workspace_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deletion_requested_at?: string | null
          id?: string
          name: string
          owner_id: string
          type: Database["public"]["Enums"]["workspace_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deletion_requested_at?: string | null
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
      ledger_entries: {
        Row: {
          account_id: string | null
          amount: number | null
          category_id: string | null
          counterparty: string | null
          created_at: string | null
          description: string | null
          id: string | null
          invoice_ref: string | null
          kind: string | null
          note: string | null
          occurred_on: string | null
          to_account_id: string | null
          workspace_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      account_balances: {
        Args: { p_workspace_id: string }
        Returns: {
          archived_at: string
          balance: number
          color: string
          created_at: string
          icon: string
          id: string
          kind: Database["public"]["Enums"]["account_kind"]
          last_activity_on: string
          name: string
          opening_balance: number
          scheduled_balance: number
          updated_at: string
          workspace_id: string
        }[]
      }
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
      business_workspace_limit: { Args: never; Returns: number }
      cancel_account_deletion: { Args: never; Returns: undefined }
      cancel_workspace_deletion: {
        Args: { p_workspace_id: string }
        Returns: undefined
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
      create_business: {
        Args: { p_name: string; p_sector: string; p_tax_id: string }
        Returns: string
      }
      create_import: {
        Args: {
          p_filename: string
          p_rows: Json
          p_sheets: string[]
          p_stats: Json
          p_target: Database["public"]["Enums"]["import_target"]
          p_workspace_id: string
        }
        Returns: string
      }
      debt_overview: {
        Args: { p_workspace_id: string }
        Returns: {
          balance: number
          closed_at: string
          closing_day: number
          counterparty: string
          created_at: string
          credit_limit: number
          due_day: number
          entries_count: number
          expected_on: string
          id: string
          installment: number
          interest_rate: number
          kind: Database["public"]["Enums"]["debt_kind"]
          last_payment_on: string
          min_payment: number
          name: string
          next_due_on: string
          opening_balance: number
          original_amount: number
          paid_current_cycle: number
          paid_previous_cycle: number
          paid_total: number
          prev_due_on: string
          rate_type: Database["public"]["Enums"]["rate_type"]
          status: Database["public"]["Enums"]["debt_status"]
          term_months: number
          updated_at: string
          workspace_id: string
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
      has_password: { Args: never; Returns: boolean }
      import_debt_entries: {
        Args: {
          p_create_transactions: boolean
          p_filename: string
          p_rows: Json
          p_sheets: string[]
          p_stats: Json
          p_workspace_id: string
        }
        Returns: string
      }
      import_goal_contributions: {
        Args: {
          p_filename: string
          p_rows: Json
          p_sheets: string[]
          p_stats: Json
          p_workspace_id: string
        }
        Returns: string
      }
      import_recurring_expenses: {
        Args: {
          p_filename: string
          p_new_categories: Json
          p_rows: Json
          p_sheets: string[]
          p_stats: Json
          p_workspace_id: string
        }
        Returns: string
      }
      import_transactions: {
        Args: {
          p_filename: string
          p_new_accounts?: Json
          p_new_categories: Json
          p_rows: Json
          p_sheets: string[]
          p_stats: Json
          p_workspace_id: string
        }
        Returns: string
      }
      is_workspace_owner: { Args: { p_workspace_id: string }; Returns: boolean }
      is_workspace_writable: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      monthly_totals: {
        Args: { p_from: string; p_to: string; p_workspace_id: string }
        Returns: {
          expense: number
          income: number
          month: string
          tx_count: number
        }[]
      }
      purge_deleted_accounts: { Args: never; Returns: number }
      record_debt_payment: {
        Args: {
          p_account_id?: string
          p_amount: number
          p_create_transaction: boolean
          p_debt_id: string
          p_note: string
          p_occurred_on: string
        }
        Returns: string
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
      request_account_deletion: { Args: never; Returns: string }
      request_workspace_deletion: {
        Args: { p_workspace_id: string }
        Returns: string
      }
      score_balances: {
        Args: { p_from: string; p_to: string; p_workspace_id: string }
        Returns: {
          balance: number
          entity_id: string
          kind: string
          month: string
        }[]
      }
      score_monthly_inputs: {
        Args: { p_from: string; p_to: string; p_workspace_id: string }
        Returns: {
          budgeted_count: number
          closing_balance: number
          expense: number
          income: number
          month: string
          within_budget_count: number
        }[]
      }
      score_weekly_activity: {
        Args: { p_from: string; p_to: string; p_workspace_id: string }
        Returns: {
          tx_count: number
          week_start: string
        }[]
      }
      transaction_totals: {
        Args: {
          p_account_id?: string
          p_category_id?: string
          p_from?: string
          p_search?: string
          p_to?: string
          p_type?: Database["public"]["Enums"]["transaction_type"]
          p_without_account?: boolean
          p_workspace_id: string
        }
        Returns: {
          expense: number
          income: number
        }[]
      }
      transactions_for_duplicates: {
        Args: { p_from: string; p_to: string; p_workspace_id: string }
        Returns: {
          amount: number
          description: string
          occurred_on: string
          type: Database["public"]["Enums"]["transaction_type"]
        }[]
      }
      undo_import: { Args: { p_import_id: string }; Returns: number }
      workspace_balance: { Args: { p_workspace_id: string }; Returns: number }
    }
    Enums: {
      account_kind: "cash" | "bank" | "wallet" | "other"
      debt_entry_kind: "payment" | "adjustment"
      debt_kind: "credit_card" | "loan" | "receivable"
      debt_status: "active" | "paid" | "archived"
      goal_status: "active" | "completed" | "archived"
      import_status: "completed" | "undone"
      import_target:
        | "transactions"
        | "recurring_expenses"
        | "debt_entries"
        | "goal_contributions"
      rate_type: "ea" | "mv"
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
      account_kind: ["cash", "bank", "wallet", "other"],
      debt_entry_kind: ["payment", "adjustment"],
      debt_kind: ["credit_card", "loan", "receivable"],
      debt_status: ["active", "paid", "archived"],
      goal_status: ["active", "completed", "archived"],
      import_status: ["completed", "undone"],
      import_target: [
        "transactions",
        "recurring_expenses",
        "debt_entries",
        "goal_contributions"
      ],
      rate_type: ["ea", "mv"],
      recurring_frequency: ["monthly", "yearly"],
      transaction_type: ["income", "expense"],
      workspace_type: ["personal", "business"]
    }
  }
} as const
