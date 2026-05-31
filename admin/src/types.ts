export interface Station {
  id: number;
  slug: string;
  name: string;
  image_url: string | null;
  image_hosted: string | null;
  image_public_id: string | null;
  image_status: string;
  image: string | null;
  stream_url: string;
  normalized_url: string;
  providers: Record<string, string>;
  countries: string[];
  genres: string[];
  languages: string[];
  status: 'working' | 'broken' | 'untested';
  codec: string | null;
  bitrate: number | null;
  sample_rate: number | null;
  failure_count: number;
  is_verified: boolean;
  play_count: number;
  last_tested_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Page<T> {
  data: T[];
  pagination: { limit: number; offset: number; total: number };
}

export interface Facet {
  value: string;
  count: number;
}

export interface Stats {
  total: number;
  by_status: Record<string, number>;
  working: number;
  verified: number;
  images: Record<string, number>;
  hosted: number;
  countries: number;
  genres: number;
  top_countries: Facet[];
  top_genres: Facet[];
}

export interface AuditEntry {
  id: number;
  action: string;
  station_id: number | null;
  actor: string;
  details: Record<string, unknown>;
  created_at: string;
}
