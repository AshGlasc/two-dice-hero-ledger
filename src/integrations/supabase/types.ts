export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      app_settings: {
        Row: {
          difficulty_modifiers: Json;
          discord_webhook: string;
          id: number;
          updated_at: string;
        };
        Insert: {
          difficulty_modifiers?: Json;
          discord_webhook?: string;
          id?: number;
          updated_at?: string;
        };
        Update: {
          difficulty_modifiers?: Json;
          discord_webhook?: string;
          id?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      catalog_items: {
        Row: {
          ammo: string | null;
          category: string;
          created_at: string;
          damage: string | null;
          description: string;
          heal_hp: number | null;
          heal_sanity: number | null;
          id: string;
          image_url: string;
          interaction_difficulty: number | null;
          interaction_skill_key: string | null;
          is_movable: boolean;
          name: string;
          range: number | null;
          restore_energy: number;
          requires_roll_to_interact: boolean;
          skill_bonuses: Json;
          skill_key: string | null;
          temp_shield: number | null;
          uses_max: number | null;
        };
        Insert: {
          ammo?: string | null;
          category?: string;
          created_at?: string;
          damage?: string | null;
          description?: string;
          heal_hp?: number | null;
          heal_sanity?: number | null;
          id?: string;
          image_url?: string;
          interaction_difficulty?: number | null;
          interaction_skill_key?: string | null;
          is_movable?: boolean;
          name: string;
          range?: number | null;
          restore_energy?: number;
          requires_roll_to_interact?: boolean;
          skill_bonuses?: Json;
          skill_key?: string | null;
          temp_shield?: number | null;
          uses_max?: number | null;
        };
        Update: {
          ammo?: string | null;
          category?: string;
          created_at?: string;
          damage?: string | null;
          description?: string;
          heal_hp?: number | null;
          heal_sanity?: number | null;
          id?: string;
          image_url?: string;
          interaction_difficulty?: number | null;
          interaction_skill_key?: string | null;
          is_movable?: boolean;
          name?: string;
          range?: number | null;
          restore_energy?: number;
          requires_roll_to_interact?: boolean;
          skill_bonuses?: Json;
          skill_key?: string | null;
          temp_shield?: number | null;
          uses_max?: number | null;
        };
        Relationships: [];
      };
      backpack_items: {
        Row: {
          character_id: string;
          catalog_item_id: string | null;
          category: string;
          created_at: string;
          heal_hp: number;
          heal_sanity: number;
          id: string;
          name: string;
          notes: string;
          quantity: number;
          restore_energy: number;
          skill_bonuses: Json;
          temp_shield: number;
        };
        Insert: {
          character_id: string;
          catalog_item_id?: string | null;
          category?: string;
          created_at?: string;
          heal_hp?: number;
          heal_sanity?: number;
          id?: string;
          name: string;
          notes?: string;
          quantity?: number;
          restore_energy?: number;
          skill_bonuses?: Json;
          temp_shield?: number;
        };
        Update: {
          character_id?: string;
          catalog_item_id?: string | null;
          category?: string;
          created_at?: string;
          heal_hp?: number;
          heal_sanity?: number;
          id?: string;
          name?: string;
          notes?: string;
          quantity?: number;
          restore_energy?: number;
          skill_bonuses?: Json;
          temp_shield?: number;
        };
        Relationships: [
          {
            foreignKeyName: "backpack_items_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      battle_map: {
        Row: {
          background_url: string;
          cols: number;
          fog: Json;
          id: number;
          rows: number;
          terrain: Json;
          tile_images: Json;
          updated_at: string;
        };
        Insert: {
          background_url?: string;
          cols?: number;
          fog?: Json;
          id?: number;
          rows?: number;
          terrain?: Json;
          tile_images?: Json;
          updated_at?: string;
        };
        Update: {
          background_url?: string;
          cols?: number;
          fog?: Json;
          id?: number;
          rows?: number;
          terrain?: Json;
          tile_images?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      battle_map_items: {
        Row: {
          catalog_item_id: string | null;
          collectible: boolean;
          collection_difficulty: number | null;
          collection_skill_key: string | null;
          created_at: string;
          icon: string;
          id: string;
          movable: boolean;
          name: string;
          x: number;
          y: number;
        };
        Insert: {
          catalog_item_id?: string | null;
          collectible?: boolean;
          collection_difficulty?: number | null;
          collection_skill_key?: string | null;
          created_at?: string;
          icon?: string;
          id?: string;
          movable?: boolean;
          name: string;
          x: number;
          y: number;
        };
        Update: {
          catalog_item_id?: string | null;
          collectible?: boolean;
          collection_difficulty?: number | null;
          collection_skill_key?: string | null;
          created_at?: string;
          icon?: string;
          id?: string;
          movable?: boolean;
          name?: string;
          x?: number;
          y?: number;
        };
        Relationships: [
          {
            foreignKeyName: "battle_map_items_catalog_item_id_fkey";
            columns: ["catalog_item_id"];
            isOneToOne: false;
            referencedRelation: "catalog_items";
            referencedColumns: ["id"];
          },
        ];
      };
      body_parts: {
        Row: {
          character_id: string;
          id: string;
          part_key: string;
          state: number;
          updated_at: string;
        };
        Insert: {
          character_id: string;
          id?: string;
          part_key: string;
          state?: number;
          updated_at?: string;
        };
        Update: {
          character_id?: string;
          id?: string;
          part_key?: string;
          state?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "body_parts_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      character_skills: {
        Row: {
          bonus: number;
          character_id: string;
          id: string;
          skill_key: string;
          updated_at: string;
        };
        Insert: {
          bonus?: number;
          character_id: string;
          id?: string;
          skill_key: string;
          updated_at?: string;
        };
        Update: {
          bonus?: number;
          character_id?: string;
          id?: string;
          skill_key?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "character_skills_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      characters: {
        Row: {
          avatar_url: string;
          concept: string;
          created_at: string;
          fisico: number;
          energia_atual: number;
          energia_maxima: number;
          id: string;
          intelecto: number;
          level: number;
          money: number;
          motor: number;
          name: string;
          notes: string;
          pin_hash: string;
          pin_salt: string;
          player_name: string;
          psique: number;
          sanity_current: number;
          sanity_max: number;
          skill_points: number;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string;
          concept?: string;
          created_at?: string;
          fisico?: number;
          energia_atual?: number;
          energia_maxima?: number;
          id?: string;
          intelecto?: number;
          level?: number;
          money?: number;
          motor?: number;
          name: string;
          notes?: string;
          pin_hash?: string;
          pin_salt?: string;
          player_name?: string;
          psique?: number;
          sanity_current?: number;
          sanity_max?: number;
          skill_points?: number;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string;
          concept?: string;
          created_at?: string;
          fisico?: number;
          energia_atual?: number;
          energia_maxima?: number;
          id?: string;
          intelecto?: number;
          level?: number;
          money?: number;
          motor?: number;
          name?: string;
          notes?: string;
          pin_hash?: string;
          pin_salt?: string;
          player_name?: string;
          psique?: number;
          sanity_current?: number;
          sanity_max?: number;
          skill_points?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      combat_state: {
        Row: {
          active: boolean;
          current_combatant_id: string | null;
          id: number;
          round: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          current_combatant_id?: string | null;
          id?: number;
          round?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          current_combatant_id?: string | null;
          id?: number;
          round?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "combat_state_current_combatant_id_fkey";
            columns: ["current_combatant_id"];
            isOneToOne: false;
            referencedRelation: "combatants";
            referencedColumns: ["id"];
          },
        ];
      };
      combatants: {
        Row: {
          attack_bonus: number;
          character_id: string | null;
          conditions: string[];
          condition_durations: Json;
          created_at: string;
          defending: boolean;
          defense: number | null;
          hp_current: number | null;
          hp_max: number | null;
          id: string;
          initiative: number | null;
          initiative_bonus: number;
          kind: string;
          monster_id: string | null;
          moved_round: number | null;
          name: string;
          pos_x: number | null;
          pos_y: number | null;
          temporary_shield: number;
        };
        Insert: {
          attack_bonus?: number;
          character_id?: string | null;
          conditions?: string[];
          condition_durations?: Json;
          created_at?: string;
          defending?: boolean;
          defense?: number | null;
          hp_current?: number | null;
          hp_max?: number | null;
          id?: string;
          initiative?: number | null;
          initiative_bonus?: number;
          kind: string;
          monster_id?: string | null;
          moved_round?: number | null;
          name: string;
          pos_x?: number | null;
          pos_y?: number | null;
          temporary_shield?: number;
        };
        Update: {
          attack_bonus?: number;
          character_id?: string | null;
          conditions?: string[];
          condition_durations?: Json;
          created_at?: string;
          defending?: boolean;
          defense?: number | null;
          hp_current?: number | null;
          hp_max?: number | null;
          id?: string;
          initiative?: number | null;
          initiative_bonus?: number;
          kind?: string;
          monster_id?: string | null;
          moved_round?: number | null;
          name?: string;
          pos_x?: number | null;
          pos_y?: number | null;
          temporary_shield?: number;
        };
        Relationships: [
          {
            foreignKeyName: "combatants_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "combatants_monster_id_fkey";
            columns: ["monster_id"];
            isOneToOne: false;
            referencedRelation: "monsters";
            referencedColumns: ["id"];
          },
        ];
      };
      combat_events: {
        Row: {
          character_id: string | null;
          character_name: string;
          created_at: string;
          description: string;
          id: string;
        };
        Insert: {
          character_id?: string | null;
          character_name: string;
          created_at?: string;
          description: string;
          id?: string;
        };
        Update: {
          character_id?: string | null;
          character_name?: string;
          created_at?: string;
          description?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "combat_events_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      gm_notes: {
        Row: {
          content: string;
          id: number;
          updated_at: string;
        };
        Insert: {
          content?: string;
          id?: number;
          updated_at?: string;
        };
        Update: {
          content?: string;
          id?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      map_layouts: {
        Row: {
          background_url: string;
          cols: number;
          created_at: string;
          fog: Json;
          id: string;
          name: string;
          rows: number;
          terrain: Json;
          tile_images: Json;
        };
        Insert: {
          background_url?: string;
          cols?: number;
          created_at?: string;
          fog?: Json;
          id?: string;
          name: string;
          rows?: number;
          terrain?: Json;
          tile_images?: Json;
        };
        Update: {
          background_url?: string;
          cols?: number;
          created_at?: string;
          fog?: Json;
          id?: string;
          name?: string;
          rows?: number;
          terrain?: Json;
          tile_images?: Json;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          amount: number | null;
          body: string;
          contact_id: string | null;
          created_at: string;
          from_character_id: string | null;
          from_name: string;
          id: string;
          kind: string;
          to_character_id: string | null;
        };
        Insert: {
          amount?: number | null;
          body?: string;
          contact_id?: string | null;
          created_at?: string;
          from_character_id?: string | null;
          from_name?: string;
          id?: string;
          kind?: string;
          to_character_id?: string | null;
        };
        Update: {
          amount?: number | null;
          body?: string;
          contact_id?: string | null;
          created_at?: string;
          from_character_id?: string | null;
          from_name?: string;
          id?: string;
          kind?: string;
          to_character_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "phone_contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_from_character_id_fkey";
            columns: ["from_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_to_character_id_fkey";
            columns: ["to_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      monsters: {
        Row: {
          abilities: string;
          attack_bonus: number;
          attacks: string;
          avatar_url: string;
          created_at: string;
          defense: number;
          description: string;
          fisico: number;
          former_life: string;
          hp_max: number;
          id: string;
          initiative_bonus: number;
          intelecto: number;
          money: number;
          motor: number;
          name: string;
          psique: number;
        };
        Insert: {
          abilities?: string;
          attack_bonus?: number;
          attacks?: string;
          avatar_url?: string;
          created_at?: string;
          defense?: number;
          description?: string;
          fisico?: number;
          former_life?: string;
          hp_max?: number;
          id?: string;
          initiative_bonus?: number;
          intelecto?: number;
          money?: number;
          motor?: number;
          name: string;
          psique?: number;
        };
        Update: {
          abilities?: string;
          attack_bonus?: number;
          attacks?: string;
          avatar_url?: string;
          created_at?: string;
          defense?: number;
          description?: string;
          fisico?: number;
          former_life?: string;
          hp_max?: number;
          id?: string;
          initiative_bonus?: number;
          intelecto?: number;
          money?: number;
          motor?: number;
          name?: string;
          psique?: number;
        };
        Relationships: [];
      };
      phone_clues: {
        Row: {
          body: string;
          created_at: string;
          headline: string;
          id: string;
          image_url: string;
        };
        Insert: {
          body?: string;
          created_at?: string;
          headline: string;
          id?: string;
          image_url?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          headline?: string;
          id?: string;
          image_url?: string;
        };
        Relationships: [];
      };
      phone_contacts: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          target_character_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          target_character_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          target_character_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "phone_contacts_target_character_id_fkey";
            columns: ["target_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      phone_gallery: {
        Row: {
          caption: string;
          character_id: string | null;
          created_at: string;
          id: string;
          image_url: string;
        };
        Insert: {
          caption?: string;
          character_id?: string | null;
          created_at?: string;
          id?: string;
          image_url: string;
        };
        Update: {
          caption?: string;
          character_id?: string | null;
          created_at?: string;
          id?: string;
          image_url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "phone_gallery_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      rolls: {
        Row: {
          character_id: string | null;
          character_name: string;
          created_at: string;
          die1: number;
          die2: number;
          difficulty: number | null;
          hidden: boolean;
          id: string;
          label: string;
          modifier: number;
          outcome: string;
          total: number;
        };
        Insert: {
          character_id?: string | null;
          character_name?: string;
          created_at?: string;
          die1: number;
          die2: number;
          difficulty?: number | null;
          hidden?: boolean;
          id?: string;
          label: string;
          modifier?: number;
          outcome: string;
          total: number;
        };
        Update: {
          character_id?: string | null;
          character_name?: string;
          created_at?: string;
          die1?: number;
          die2?: number;
          difficulty?: number | null;
          hidden?: boolean;
          id?: string;
          label?: string;
          modifier?: number;
          outcome?: string;
          total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "rolls_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      sanity_whispers: {
        Row: {
          character_id: string;
          created_at: string;
          id: string;
          message: string;
        };
        Insert: {
          character_id: string;
          created_at?: string;
          id?: string;
          message: string;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          id?: string;
          message?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sanity_whispers_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      weapons: {
        Row: {
          ammo: string;
          character_id: string;
          created_at: string;
          damage: string;
          id: string;
          name: string;
          notes: string;
          range: number;
          skill_key: string;
          uses_current: number;
          uses_max: number;
          weapon_type: string;
        };
        Insert: {
          ammo?: string;
          character_id: string;
          created_at?: string;
          damage?: string;
          id?: string;
          name: string;
          notes?: string;
          range?: number;
          skill_key?: string;
          uses_current?: number;
          uses_max?: number;
          weapon_type?: string;
        };
        Update: {
          ammo?: string;
          character_id?: string;
          created_at?: string;
          damage?: string;
          id?: string;
          name?: string;
          notes?: string;
          range?: number;
          skill_key?: string;
          uses_current?: number;
          uses_max?: number;
          weapon_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "weapons_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      transfer_money: {
        Args: { _amount: number; _from: string; _note?: string; _to: string };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
