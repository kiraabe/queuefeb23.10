/**
 * Geolocation utility for IP address lookup
 * Uses ip-api.com free tier API for country, city, and region data
 */

export interface GeoLocation {
  country: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
}

// Cache geolocation lookups for 24 hours to reduce API calls
const geoCache = new Map<string, { data: GeoLocation; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Look up geolocation data for an IP address
 * Returns cached data if available, otherwise fetches from ip-api.com
 */
export async function getGeolocation(ipAddress: string): Promise<GeoLocation> {
  // Skip lookup for localhost or invalid IPs
  if (!ipAddress || ipAddress === "127.0.0.1" || ipAddress === "::1" || ipAddress.includes("::ffff:127")) {
    return { country: null, countryCode: null, city: null, region: null };
  }

  // Check cache
  const cached = geoCache.get(ipAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Fetch from ip-api.com (free tier: 45 requests/minute, no API key needed)
    const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=country,countryCode,city,region,status`, {
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // ip-api.com returns status: "success" or "fail"
    if (data.status !== "success") {
      return { country: null, countryCode: null, city: null, region: null };
    }

    const geoData: GeoLocation = {
      country: data.country || null,
      countryCode: data.countryCode || null,
      city: data.city || null,
      region: data.region || null,
    };

    // Cache the result
    geoCache.set(ipAddress, { data: geoData, timestamp: Date.now() });

    return geoData;
  } catch (error) {
    console.warn(`Geolocation lookup failed for IP ${ipAddress}:`, error instanceof Error ? error.message : String(error));
    // Return null values on failure, don't throw
    return { country: null, countryCode: null, city: null, region: null };
  }
}
