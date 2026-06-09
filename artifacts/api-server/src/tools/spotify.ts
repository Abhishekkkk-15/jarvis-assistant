import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import SpotifyWebApi from "spotify-web-api-node";

import { db, settingsTable } from "@workspace/db";

async function getSpotifyClient() {
  const rows = await db.select().from(settingsTable).limit(1);
  const settings = rows[0];
  const clientId = settings?.spotifyClientId || process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = settings?.spotifyClientSecret || process.env.SPOTIFY_CLIENT_SECRET;
  const accessToken = process.env.SPOTIFY_ACCESS_TOKEN;
  
  if (!clientId || !clientSecret) {
    throw new Error("Spotify Client ID and Secret are not configured in Settings.");
  }
  
  const spotify = new SpotifyWebApi({
    clientId,
    clientSecret,
  });
  
  if (accessToken) {
    spotify.setAccessToken(accessToken);
  }
  
  return spotify;
}

export const spotifySearch = new DynamicStructuredTool({
  name: "spotify_search_track",
  description: "Search Spotify for a track, artist, or album. Returns details including the Spotify URI.",
  schema: z.object({
    query: z.string().describe("The search query (e.g., track name or artist)."),
  }),
  func: async ({ query }: { query: string }) => {
    try {
      const spotify = await getSpotifyClient();
      
      // If we don't have an access token, use client credentials to get one
      if (!spotify.getAccessToken()) {
        const data = await spotify.clientCredentialsGrant();
        spotify.setAccessToken(data.body['access_token']);
      }
      
      const response = await spotify.searchTracks(query, { limit: 5 });
      if (!response.body.tracks || response.body.tracks.items.length === 0) {
        return `No tracks found for "${query}"`;
      }
      
      const results = response.body.tracks.items.map(t => {
        return `- ${t.name} by ${t.artists.map(a => a.name).join(', ')} (URI: ${t.uri})`;
      }).join("\n");
      
      return `Spotify search results for "${query}":\n${results}`;
    } catch (e: any) {
      return `Error searching Spotify: ${e.message}`;
    }
  },
});

export const spotifyPlay = new DynamicStructuredTool({
  name: "spotify_play",
  description: "Play a specific track, album, or playlist on the user's active Spotify device. Requires OAuth Access Token.",
  schema: z.object({
    uri: z.string().optional().describe("The Spotify URI to play (e.g., spotify:track:4iV5W9uYEdYUVa79Axb7Rh). If omitted, resumes current playback."),
  }),
  func: async ({ uri }: { uri?: string }) => {
    try {
      const spotify = await getSpotifyClient();
      if (!spotify.getAccessToken() || !process.env.SPOTIFY_ACCESS_TOKEN) {
        return "Error: Cannot control playback without a user OAuth Access Token (SPOTIFY_ACCESS_TOKEN).";
      }
      
      const options = uri ? { uris: [uri] } : {};
      await spotify.play(options);
      return `Successfully started playback${uri ? ` for ${uri}` : ''}.`;
    } catch (e: any) {
      return `Error controlling Spotify playback: ${e.message}`;
    }
  },
});

export const spotifyPause = new DynamicStructuredTool({
  name: "spotify_pause",
  description: "Pause the current playing track on Spotify. Requires OAuth Access Token.",
  schema: z.object({}),
  func: async () => {
    try {
      const spotify = await getSpotifyClient();
      if (!spotify.getAccessToken() || !process.env.SPOTIFY_ACCESS_TOKEN) {
        return "Error: Cannot control playback without a user OAuth Access Token (SPOTIFY_ACCESS_TOKEN).";
      }
      await spotify.pause();
      return `Successfully paused playback.`;
    } catch (e: any) {
      return `Error pausing Spotify: ${e.message}`;
    }
  },
});

export const spotifyTools = [spotifySearch, spotifyPlay, spotifyPause];
