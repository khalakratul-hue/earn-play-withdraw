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
      app_settings: {
        Row: {
          ad_frequency: number
          ad_price_per_day: number
          ad_unit_id: string
          deposit_notice: string
          id: number
          notice: string
          pay_numbers: Json
          rules: string
          uploads_enabled: boolean
          vip_benefits: string
          vip_days: number
          vip_price: number
          watch_reward: number
          watch_seconds: number
        }
        Insert: {
          ad_frequency?: number
          ad_price_per_day?: number
          ad_unit_id?: string
          deposit_notice?: string
          id?: number
          notice?: string
          pay_numbers?: Json
          rules?: string
          uploads_enabled?: boolean
          vip_benefits?: string
          vip_days?: number
          vip_price?: number
          watch_reward?: number
          watch_seconds?: number
        }
        Update: {
          ad_frequency?: number
          ad_price_per_day?: number
          ad_unit_id?: string
          deposit_notice?: string
          id?: number
          notice?: string
          pay_numbers?: Json
          rules?: string
          uploads_enabled?: boolean
          vip_benefits?: string
          vip_days?: number
          vip_price?: number
          watch_reward?: number
          watch_seconds?: number
        }
        Relationships: []
      }
      comments: {
        Row: {
          created_at: string
          id: string
          text: string
          user_id: string
          username: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          text: string
          user_id: string
          username: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          text?: string
          user_id?: string
          username?: string
          video_id?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount: number
          created_at: string
          decided_at: string | null
          details: Json
          id: string
          kind: string
          method: string
          status: string
          trx_id: string
          user_id: string
          username: string
        }
        Insert: {
          amount: number
          created_at?: string
          decided_at?: string | null
          details?: Json
          id?: string
          kind: string
          method: string
          status?: string
          trx_id: string
          user_id: string
          username: string
        }
        Update: {
          amount?: number
          created_at?: string
          decided_at?: string | null
          details?: Json
          id?: string
          kind?: string
          method?: string
          status?: string
          trx_id?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      gifts: {
        Row: {
          coins: number
          created_at: string
          creator: string
          emoji: string
          gift: string
          id: string
          sender_id: string
        }
        Insert: {
          coins: number
          created_at?: string
          creator: string
          emoji: string
          gift: string
          id?: string
          sender_id: string
        }
        Update: {
          coins?: number
          created_at?: string
          creator?: string
          emoji?: string
          gift?: string
          id?: string
          sender_id?: string
        }
        Relationships: []
      }
      penalties: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          block_reason: string
          blocked: boolean
          checkin_streak: number
          coins: number
          created_at: string
          id: string
          last_checkin: string | null
          points: number
          referral_code: string
          referrals: number
          referred_by: string | null
          username: string
          vip_until: string | null
        }
        Insert: {
          block_reason?: string
          blocked?: boolean
          checkin_streak?: number
          coins?: number
          created_at?: string
          id: string
          last_checkin?: string | null
          points?: number
          referral_code?: string
          referrals?: number
          referred_by?: string | null
          username?: string
          vip_until?: string | null
        }
        Update: {
          block_reason?: string
          blocked?: boolean
          checkin_streak?: number
          coins?: number
          created_at?: string
          id?: string
          last_checkin?: string | null
          points?: number
          referral_code?: string
          referrals?: number
          referred_by?: string | null
          username?: string
          vip_until?: string | null
        }
        Relationships: []
      }
      rewards: {
        Row: {
          created_at: string
          item_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          item_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          item_key?: string
          user_id?: string
        }
        Relationships: []
      }
      uploads: {
        Row: {
          caption: string
          created_at: string
          id: string
          status: string
          url: string
          user_id: string
          username: string
        }
        Insert: {
          caption?: string
          created_at?: string
          id?: string
          status?: string
          url: string
          user_id: string
          username: string
        }
        Update: {
          caption?: string
          created_at?: string
          id?: string
          status?: string
          url?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          phone: string
          status: string
          user_id: string
          username: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: string
          phone: string
          status?: string
          user_id: string
          username: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          phone?: string
          status?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_referral: { Args: { _code: string }; Returns: boolean }
      claim_reward: { Args: { _key: string; _kind: string }; Returns: number }
      daily_checkin: { Args: never; Returns: number }
      ensure_profile: {
        Args: { _username: string }
        Returns: {
          block_reason: string
          blocked: boolean
          checkin_streak: number
          coins: number
          created_at: string
          id: string
          last_checkin: string | null
          points: number
          referral_code: string
          referrals: number
          referred_by: string | null
          username: string
          vip_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      feed_promos: {
        Args: never
        Returns: {
          decided_at: string
          details: Json
          id: string
          kind: string
          username: string
        }[]
      }
      is_blocked: { Args: { _uid: string }; Returns: boolean }
      request_withdraw: {
        Args: { _amount: number; _method: string; _phone: string }
        Returns: boolean
      }
      send_gift: {
        Args: {
          _coins: number
          _creator: string
          _emoji: string
          _gift: string
        }
        Returns: boolean
      }
      vip_usernames: { Args: never; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
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
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
