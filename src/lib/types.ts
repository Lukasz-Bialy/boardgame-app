export interface Game {
  id: string;
  name: string;
  image_url: string | null;
  min_players: number | null;
  max_players: number | null;
  play_time: number | null;
  description: string | null;
  created_at: string;
}

export interface GameWithStats extends Game {
  play_count: number;
  avg_rating: number | null;
  rating_count: number;
}

export interface Placement {
  id: string;
  session_id: string;
  player: string;
  place: number;
}

export interface PlaySession {
  id: string;
  game_id: string;
  played_at: string;
  duration_min: number | null;
  note: string | null;
  created_by: string;
  created_at: string;
  placements: Placement[];
}

export interface Rating {
  game_id: string;
  username: string;
  score: number;
}

export type PollType = "game" | "date";

export interface PollOption {
  id: string;
  poll_id: string;
  label: string;
  game_id: string | null;
  date_value: string | null;
  sort: number;
}

export interface Poll {
  id: string;
  token: string;
  title: string;
  type: PollType;
  month: string | null;
  is_open: number;
  created_by: string;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  option_id: string;
  voter: string;
  created_at: string;
}

export interface PollWithResults extends Poll {
  options: (PollOption & { votes: number; voters: string[] })[];
  totalVoters: number;
  myVotes: string[]; // option ids zaznaczone przez bieżącego użytkownika
}

export interface Meeting {
  id: string;
  date: string;
  title: string;
  note: string | null;
  poll_token: string | null;
  created_by: string;
  created_at: string;
}

export interface MeetingWithPoll extends Meeting {
  poll_title: string | null;
  poll_is_open: number | null;
}

export interface WishlistItem {
  id: string;
  name: string;
  url: string | null;
  image_url: string | null;
  note: string | null;
  added_by: string;
  created_at: string;
}

export interface KebabRestaurant {
  id: string;
  name: string;
  address: string | null;
  url: string | null;
  created_by: string;
  created_at: string;
}

export interface KebabRestaurantWithStats extends KebabRestaurant {
  order_count: number;
  avg_rating: number | null;
  total_spent: number;
}

export interface KebabOrder {
  id: string;
  restaurant_id: string;
  meeting_id: string | null;
  date: string;
  note: string | null;
  delivery_cost: number;
  paid_by: string | null;
  created_by: string;
  created_at: string;
}

export interface KebabItem {
  id: string;
  order_id: string;
  username: string;
  item_name: string;
  price: number;
  rating: number | null;
  comment: string | null;
  created_at: string;
}

export interface KebabOrderWithDetails extends KebabOrder {
  restaurant_name: string;
  meeting_title: string | null;
  items: KebabItem[];
  settled_usernames: string[];
}

export interface ChatMessage {
  id: number;
  username: string;
  body: string;
  created_at: string;
}

export interface GiftDraw {
  id: string;
  title: string;
  budget: number | null; // grosze
  note: string | null;
  created_by: string;
  created_at: string;
}

/** Losowanie widziane przez konkretnego użytkownika — bez cudzych par. */
export interface GiftDrawForUser extends GiftDraw {
  participants: string[];
  my_receiver: string | null; // null = użytkownik nie bierze udziału
}

export interface GiftPair {
  giver: string;
  receiver: string;
}

export interface PlayerGameStat {
  game_id: string;
  game_name: string;
  games: number;
  first: number;
  second: number;
  third: number;
  other: number;
}
