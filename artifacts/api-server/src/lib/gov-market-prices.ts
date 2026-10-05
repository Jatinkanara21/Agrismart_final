export const MARKET_PRICE_SOURCE = "Government of India data.gov.in / AGMARKNET";
export const MARKET_PRICE_SOURCE_URL =
  "https://www.data.gov.in/catalog/current-daily-price-various-commodities-various-markets-mandi";

const RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
const MAX_RECORD_AGE_DAYS = 7;
const MAX_RECORDS = 250;

type SourceRecord = {
  state?: unknown;
  district?: unknown;
  market?: unknown;
  commodity?: unknown;
  variety?: unknown;
  grade?: unknown;
  arrival_date?: unknown;
  min_price?: unknown;
  max_price?: unknown;
  modal_price?: unknown;
};

type PriceFilters = {
  crop?: string;
  state?: string;
  market?: string;
  date?: string;
};

export type OfficialMarketPrice = {
  id: string;
  cropName: string;
  variety: string | null;
  grade: string | null;
  state: string;
  district: string;
  market: string;
  originalMarketPrice: number;
  originalMarketDate: string;
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
  unit: string;
  marketDate: string;
  source: string;
};

type ParsedMarketPrice = OfficialMarketPrice & {
  reportedModalPrice: number;
};

export type MarketPriceFeed = {
  status: "available" | "unavailable";
  source: string;
  sourceUrl: string;
  retrievedAt: string | null;
  message: string;
  records: OfficialMarketPrice[];
};

function unavailable(message: string): MarketPriceFeed {
  return {
    status: "unavailable",
    source: MARKET_PRICE_SOURCE,
    sourceUrl: MARKET_PRICE_SOURCE_URL,
    retrievedAt: null,
    message,
    records: [],
  };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function price(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseArrivalDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${yearText}-${monthText}-${dayText}`;
}

function indiaDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isRecent(marketDate: string, today: string): boolean {
  const ageDays =
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${marketDate}T00:00:00Z`)) /
    86_400_000;
  return ageDays >= 0 && ageDays <= MAX_RECORD_AGE_DAYS;
}

function toOfficialMarketPrice(record: SourceRecord): ParsedMarketPrice | null {
  const state = text(record.state);
  const district = text(record.district);
  const market = text(record.market);
  const cropName = text(record.commodity);
  const marketDate = parseArrivalDate(record.arrival_date);
  const minPrice = price(record.min_price);
  const maxPrice = price(record.max_price);
  const modalPrice = price(record.modal_price);

  if (
    !state ||
    !district ||
    !market ||
    !cropName ||
    !marketDate ||
    minPrice === null ||
    maxPrice === null ||
    modalPrice === null ||
    minPrice > maxPrice
  ) {
    return null;
  }

  const variety = text(record.variety);
  const grade = text(record.grade);
  const id = [
    state,
    district,
    market,
    cropName,
    variety ?? "",
    grade ?? "",
    marketDate,
  ]
    .map(encodeURIComponent)
    .join(":");

  return {
    id,
    cropName,
    variety,
    grade,
    state,
    district,
    market,
    // Grouping later will select the earliest and latest actual modal reports.
    originalMarketPrice: modalPrice,
    originalMarketDate: marketDate,
    currentPrice: modalPrice,
    minPrice,
    maxPrice,
    unit: "INR per quintal",
    marketDate,
    source: MARKET_PRICE_SOURCE,
    reportedModalPrice: modalPrice,
  };
}

function matches(value: string, filter: string | undefined): boolean {
  return !filter || value.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase());
}

function groupByMarketItem(records: ParsedMarketPrice[]): OfficialMarketPrice[] {
  const groups = new Map<string, ParsedMarketPrice[]>();
  for (const record of records) {
    const key = [
      record.state,
      record.district,
      record.market,
      record.cropName,
      record.variety ?? "",
      record.grade ?? "",
    ].join("\u0000");
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    const ordered = [...group].sort((a, b) => a.marketDate.localeCompare(b.marketDate));
    const original = ordered[0]!;
    const latest = ordered[ordered.length - 1]!;
    const {
      reportedModalPrice: currentPrice,
      ...latestRecord
    } = latest;
    return {
      ...latestRecord,
      originalMarketPrice: original.reportedModalPrice,
      originalMarketDate: original.marketDate,
      currentPrice,
      marketDate: latest.marketDate,
    };
  });
}

export async function fetchOfficialMarketPrices(
  filters: PriceFilters,
): Promise<MarketPriceFeed> {
  const apiKey = process.env.DATA_GOV_IN_API_KEY;
  if (!apiKey) {
    return unavailable(
      "Official mandi prices are unavailable because the data.gov.in feed is not configured. No prices are shown.",
    );
  }

  const url = new URL(`https://api.data.gov.in/resource/${RESOURCE_ID}`);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1000");
  url.searchParams.set("sort[desc]", "arrival_date");

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      return unavailable(
        `The official mandi feed could not be read (HTTP ${response.status}). No prices are shown.`,
      );
    }

    const payload: unknown = await response.json();
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("records" in payload) ||
      !Array.isArray(payload.records)
    ) {
      return unavailable(
        "The official mandi feed returned an unexpected response. No prices are shown.",
      );
    }

    const retrievedAt = new Date().toISOString();
    const today = indiaDate(new Date(retrievedAt));
    const recentRecords = payload.records
      .map((record) => toOfficialMarketPrice(record as SourceRecord))
      .filter((record): record is ParsedMarketPrice =>
        record ? isRecent(record.marketDate, today) : false,
      )
      .sort((a, b) => b.marketDate.localeCompare(a.marketDate));

    if (recentRecords.length === 0) {
      return {
        status: "unavailable",
        source: MARKET_PRICE_SOURCE,
        sourceUrl: MARKET_PRICE_SOURCE_URL,
        retrievedAt,
        message: `The feed returned no valid mandi reports dated within the last ${MAX_RECORD_AGE_DAYS} days. Older prices are withheld.`,
        records: [],
      };
    }

    const filteredRecords = recentRecords
      .filter(
        (record) =>
          matches(record.cropName, filters.crop) &&
          matches(record.state, filters.state) &&
          matches(record.market, filters.market) &&
          (!filters.date || record.marketDate === filters.date),
      );
    const records = groupByMarketItem(filteredRecords).slice(0, MAX_RECORDS);

    return {
      status: "available",
      source: MARKET_PRICE_SOURCE,
      sourceUrl: MARKET_PRICE_SOURCE_URL,
      retrievedAt,
      message:
        records.length > 0
          ? "Original and current prices are source-reported modal prices: the earliest and latest reports available in the last 7 days. If only one report exists, both values are from that report. The source does not provide a time of day."
          : "No recent official reports match these filters. No prices are shown.",
      records,
    };
  } catch {
    return unavailable(
      "The official mandi feed could not be reached. No prices are shown until current source data is available.",
    );
  }
}