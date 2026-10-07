import type { Ability, CheckKind, Scores } from "./rules";

export type CampaignStatus = "setup" | "active" | "ended";

export interface Enemy {
  name: string;
  hp: number;
  max_hp: number;
  ac: number;
  note?: string;
}

export interface VisitedLocation {
  name: string;
  image_id: string | null;
}

export interface Campaign {
  id: string;
  title: string;
  premise: string | null;
  tone: string;
  status: CampaignStatus;
  round: number;
  round_started_at: string | null;
  summary: string | null;
  location: string | null;
  map_image_id: string | null;
  locations: VisitedLocation[];
  enemies: Enemy[];
  gm_lock: string | null;
  gm_error: string | null;
  created_by: string;
  created_at: string;
}

export interface CampaignListItem extends Campaign {
  party: { username: string; name: string; portrait_image_id: string | null; class_id: string; race_id: string }[];
  last_post_at: string | null;
  post_count: number;
  cover_image_id: string | null;
}

export interface Character {
  id: string;
  campaign_id: string;
  username: string;
  name: string;
  race_id: string;
  class_id: string;
  level: number;
  xp: number;
  scores: Scores;
  hp: number;
  max_hp: number;
  ac: number;
  inventory: string[];
  conditions: string[];
  look: string | null;
  backstory: string | null;
  portrait_image_id: string | null;
  introduced: number;
  death_successes: number;
  death_failures: number;
  created_at: string;
}

export type PostKind = "narration" | "action" | "roll" | "system";

// Zmiana stanu zastosowana przez serwer po turze MG — pokazywana jako plakietki pod narracją
export interface AppliedChange {
  character: string;
  text: string;
  tone: "good" | "bad" | "neutral";
}

export interface RollData {
  roll_id?: string;
  sides: number;
  result: number;
  modifier: number;
  total: number;
  dc?: number;
  success?: boolean;
  label: string;
  damage?: string | null;
  damage_result?: number | null;
  auto?: boolean;
  character_name?: string;
  // Rzut przeciw śmierci: licznik po rzucie i rozstrzygnięcie
  death?: { successes: number; failures: number; outcome: "stable" | "dead" | "revived" | null };
}

export interface Post {
  id: number;
  campaign_id: string;
  round: number;
  author: string;
  kind: PostKind;
  body: string;
  image_id: string | null;
  data: { changes?: AppliedChange[]; roll?: RollData; location?: string | null } | null;
  created_at: string;
}

export interface Roll {
  id: string;
  campaign_id: string;
  character_id: string;
  round: number;
  kind: CheckKind;
  ability: Ability;
  skill: string | null;
  dc: number;
  reason: string | null;
  damage: string | null;
  modifier: number;
  result: number | null;
  damage_result: number | null;
  auto: number;
  created_at: string;
  rolled_at: string | null;
}
