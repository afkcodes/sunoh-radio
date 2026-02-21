export interface RadioStation {
  id: string;
  name: string;
  image: string;
  stream_url: string;
  provider: string;
  country: string;
  genres: string[];
  languages: string[];
  website: string;
  description: string;
  status: 'working' | 'broken' | 'untested';
  codec?: string;
  bitrate?: number;
  sample_rate?: number;
  last_tested_at: string;
}
