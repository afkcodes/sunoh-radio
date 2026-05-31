import { config } from '../../config';

/** A single station as returned by the API (also used for fast serialization). */
export const stationProperties = {
  id: { type: 'integer' },
  slug: { type: 'string' },
  name: { type: 'string' },
  image_url: { type: ['string', 'null'] },
  image_hosted: { type: ['string', 'null'] },
  image: { type: ['string', 'null'] }, // resolved: image_hosted ?? image_url
  stream_url: { type: 'string' },
  countries: { type: 'array', items: { type: 'string' } },
  genres: { type: 'array', items: { type: 'string' } },
  languages: { type: 'array', items: { type: 'string' } },
  status: { type: 'string' },
  codec: { type: ['string', 'null'] },
  bitrate: { type: ['integer', 'null'] },
  sample_rate: { type: ['integer', 'null'] },
  play_count: { type: 'integer' },
} as const;

/** Querystring schema for GET /stations — Fastify coerces + validates (400 on bad input). */
export const listStationsSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      country: { type: 'string', minLength: 1 },
      genre: { type: 'string', minLength: 1 },
      language: { type: 'string', minLength: 1 },
      status: { type: 'string', enum: ['working', 'broken', 'untested'], default: 'working' },
      q: { type: 'string', minLength: 1, maxLength: 100 },
      limit: { type: 'integer', minimum: 1, maximum: config.api.maxLimit, default: config.api.defaultLimit },
      offset: { type: 'integer', minimum: 0, maximum: config.api.maxOffset, default: 0 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: stationProperties } },
        pagination: {
          type: 'object',
          properties: {
            limit: { type: 'integer' },
            offset: { type: 'integer' },
            total: { type: 'integer' },
          },
        },
      },
    },
  },
} as const;

export const getStationSchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['slug'],
    properties: { slug: { type: 'string', minLength: 1 } },
  },
} as const;

// GET /stations/recent — newest stations, optionally scoped to a country.
export const recentStationsSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      country: { type: 'string', minLength: 1 },
      status: { type: 'string', enum: ['working', 'broken', 'untested'], default: 'working' },
      days: { type: 'integer', minimum: 1, maximum: 365 }, // optional recency window
      limit: { type: 'integer', minimum: 1, maximum: config.api.maxLimit, default: 20 },
      offset: { type: 'integer', minimum: 0, maximum: config.api.maxOffset, default: 0 },
    },
  },
  response: listStationsSchema.response,
} as const;
