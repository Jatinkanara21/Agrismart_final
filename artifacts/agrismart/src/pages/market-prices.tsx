import { useEffect, useState } from "react";
import { useListMarketPrices } from "@workspace/api-client-react";
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  ExternalLink,
  MapPin,
  RefreshCw,
  Search,
  Sprout,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatMarketDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatCheckedAt(value: string): string {
  return `${new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value))} IST`;
}

export default function MarketPrices() {
  const [searchTerm, setSearchTerm] = useState("");
  const [cropFilter, setCropFilter] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => setCropFilter(searchTerm.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  const {
    data: feed,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useListMarketPrices(
    { crop: cropFilter || undefined },
    { query: { refetchInterval: 5 * 60 * 1000, retry: 1 } },
  );

  const unavailableMessage = isError
    ? "The official mandi feed could not be checked. No prices are shown."
    : feed?.message;
  const records = !isError && feed?.status === "available" ? feed.records : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
            <Sprout className="h-8 w-8 text-primary" />
            Mandi Market Prices
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Recent daily wholesale prices reported by India&apos;s official mandi
            data feed. Prices older than 7 days are withheld.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          data-testid="button-refresh-market-prices"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium">Source and reporting time</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Government of India data.gov.in, generated through AGMARKNET.
                The source reports a market date, not a time of day. “Checked”
                is when AgriSmart queried the feed.
              </p>
              {feed?.retrievedAt && (
                <p className="mt-2 text-xs text-muted-foreground" data-testid="text-feed-checked-at">
                  Last checked: {formatCheckedAt(feed.retrievedAt)}
                </p>
              )}
            </div>
          </div>
          {feed && (
            <a
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
              href={feed.sourceUrl}
              target="_blank"
              rel="noreferrer"
              data-testid="link-official-market-price-source"
            >
              Official source
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Latest reported prices</CardTitle>
            <CardDescription>
              Original price is the earliest source report available in the last
              7 days; current price is the latest report. Both are official
              modal prices, not estimates.
            </CardDescription>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search crops..."
              className="pl-9"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              data-testid="input-search-market-crop"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-56 w-full rounded-lg" />
              ))}
            </div>
          ) : isError || feed?.status === "unavailable" ? (
            <div
              className="flex items-start gap-3 rounded-lg border border-amber-300/70 bg-amber-50/70 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
              role="status"
              data-testid="status-market-feed-unavailable"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Current market prices unavailable</p>
                <p className="mt-1 text-sm">
                  {unavailableMessage ??
                    "No recent official market prices are available. No prices are shown."}
                </p>
                <p className="mt-2 text-sm">
                  Older or estimated prices are not substituted.
                </p>
                {feed?.sourceUrl && (
                  <a
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4"
                    href={feed.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    data-testid="link-market-feed-unavailable-source"
                  >
                    Check the Government of India source
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-lg border border-dashed px-6 py-12 text-center">
              <p className="font-medium">No recent reports found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {cropFilter
                  ? `No current official reports matched “${cropFilter}”.`
                  : "The official feed has no recent reports to display."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {records.map((item) => (
                <Card
                  key={item.id}
                  className="overflow-hidden"
                  data-testid={`card-market-price-${item.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{item.cropName}</CardTitle>
                        <CardDescription className="mt-1">
                          {item.variety || "Variety not reported"}
                          {item.grade ? ` · ${item.grade}` : ""}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">Official daily report</Badge>
                    </div>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {item.market}, {item.district}, {item.state}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-md bg-muted/50 p-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          Original market price
                        </p>
                        <p className="mt-1 text-lg font-semibold">
                          {currencyFormatter.format(item.originalMarketPrice)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMarketDate(item.originalMarketDate)} · {item.unit}
                        </p>
                      </div>
                      <div className="rounded-md bg-primary/5 p-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          Current price
                        </p>
                        <p className="mt-1 text-lg font-semibold text-primary">
                          {currencyFormatter.format(item.currentPrice)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMarketDate(item.marketDate)} · {item.unit}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                      <span>
                        Official range: {currencyFormatter.format(item.minPrice)}–
                        {currencyFormatter.format(item.maxPrice)} / quintal
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        Report time not provided
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Source: {item.source}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}