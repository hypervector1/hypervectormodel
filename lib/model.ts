export const MODEL_VERSION = "V16.5";

export type ModelStatus = "BREAKOUT" | "RISING" | "EARLY" | "COOLING" | "FADING" | "UNVERIFIED";

export type BreakoutPrediction = {
  calculated_velocity?: number;
  calculated_acceleration?: number;
  breakout_score?: number;
  confidence?: number;
  evidence_strength?: number;
  early_signal?: boolean;
  meme_class?: string;
  signal_tier?: string;
  prediction_class?: string;
  event_count_24h?: number;
  publisher_count_24h?: number;
  source_count_24h?: number;
  meme_potential?: number;
  remixability?: number;
  evidence_reasons?: string[];
};

export type TrendInput = {
  id: string;
  name: string;
  category?: string | null;
  source?: string | null;
  score?: number | null;
  velocity?: number | null;
  acceleration?: number | null;
  spread?: number | null;
  adoption?: number | null;
  longevity?: number | null;
  status?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  metadata?: Record<string, unknown> | null;
  events?: number | null;
  publishers?: number | null;
  evidence?: number | null;
  meme?: number | null;
  hype_score?: number | null;
  confidence?: number | null;
  breakout_prediction?: BreakoutPrediction | null;
};

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

const pct = (v: unknown) => clamp(num(v));

const logActivity = (value: unknown, ceiling: number) => {
  const n = Math.max(0, num(value));
  if (!n) return 0;
  return clamp((Math.log1p(n) / Math.log1p(ceiling)) * 100);
};

function predictionOf(t: TrendInput): BreakoutPrediction | null {
  if (t.breakout_prediction && typeof t.breakout_prediction === "object") return t.breakout_prediction;
  const raw = t.metadata?.breakout_prediction;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as BreakoutPrediction;
  return null;
}

export function scoreTrend(t: TrendInput) {
  const bp = predictionOf(t);
  const verified = !!bp;

  const velocity = pct(bp?.calculated_velocity ?? t.velocity);
  const acceleration = pct(bp?.calculated_acceleration ?? t.acceleration);
  const spread = pct(t.spread);
  const adoption = pct(t.adoption);
  const evidence = pct(bp?.evidence_strength ?? t.evidence);
  const baseScore = pct(t.score);
  const eventsRaw = bp?.event_count_24h ?? t.events;
  const publishersRaw = bp?.publisher_count_24h ?? t.publishers;
  const sourceCount = num(bp?.source_count_24h, 0);
  const events = logActivity(eventsRaw, 100);
  const publishers = logActivity(publishersRaw, 25);
  const meme = pct(bp?.meme_potential ?? t.meme ?? bp?.remixability);
  const longevity = pct(t.longevity);

  // A continuous score. Legacy score is a small anchor, not the driver.
  const hype = clamp(
    velocity * 0.30 +
    acceleration * 0.20 +
    spread * 0.12 +
    adoption * 0.10 +
    evidence * 0.10 +
    publishers * 0.08 +
    events * 0.05 +
    meme * 0.03 +
    baseScore * 0.02,
  );

  const corroboration = clamp(
    publishers * 0.50 +
    spread * 0.25 +
    clamp(sourceCount * 20) * 0.25,
  );

  const confidence = verified
    ? clamp(evidence * 0.45 + corroboration * 0.30 + clamp(events) * 0.15 + clamp(publishers) * 0.10, 0, 99)
    : 0;

  const eventN = num(eventsRaw);
  const publisherN = num(publishersRaw);
  const hasEnoughEvidence = verified && eventN >= 2 && publisherN >= 2;
  const strongVelocity = velocity >= 55;
  const accelerating = acceleration >= 18;
  const broad = spread >= 40 || publisherN >= 4 || sourceCount >= 3;

  let status: ModelStatus;

  if (!verified) {
    status = "UNVERIFIED";
  } else if (hype >= 70 && strongVelocity && accelerating && broad && confidence >= 45) {
    status = "BREAKOUT";
  } else if (hype >= 42 && (velocity >= 25 || acceleration >= 10) && confidence >= 28 && hasEnoughEvidence) {
    status = "RISING";
  } else if (hype >= 22 && (velocity >= 8 || acceleration >= 5 || spread >= 20) && hasEnoughEvidence) {
    status = "EARLY";
  } else if (longevity >= 35 && velocity < 15 && hype < 35 && hasEnoughEvidence) {
    status = "FADING";
  } else {
    status = "COOLING";
  }

  const reasons: string[] = [];
  if (velocity >= 70) reasons.push("high velocity");
  else if (velocity >= 25) reasons.push("momentum building");
  if (acceleration >= 25) reasons.push("acceleration confirmed");
  else if (acceleration >= 10) reasons.push("acceleration detected");
  if (spread >= 40 || sourceCount >= 3) reasons.push("cross-source spread");
  if (publisherN >= 3) reasons.push(`${publisherN} publishers`);
  if (eventN >= 4) reasons.push(`${eventN} events / 24h`);
  if (evidence >= 50) reasons.push("strong evidence");
  if (meme >= 40) reasons.push("meme potential");
  if (!verified) reasons.push("evidence collection pending");
  if (reasons.length === 0) reasons.push("signal developing");

  return {
    model_version: MODEL_VERSION,
    hype_score: Number(hype.toFixed(1)),
    confidence: Number(confidence.toFixed(1)),
    status,
    momentum: Number(hype.toFixed(1)),
    reasons: reasons.slice(0, 4),
    verified,
    evidence_quality: verified ? (hasEnoughEvidence ? "verified" : "thin") : "missing",
    raw: {
      velocity,
      acceleration,
      spread,
      adoption,
      evidence,
      events: eventN,
      publishers: publisherN,
      sourceCount,
      meme,
      longevity,
    },
  };
}

export function normalizeTrend(row: TrendInput): TrendInput {
  const metadata = row.metadata ?? {};
  const raw = metadata.breakout_prediction;
  const bp = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as BreakoutPrediction : null;
  return {
    ...row,
    breakout_prediction: bp,
    events: bp?.event_count_24h ?? row.events ?? null,
    publishers: bp?.publisher_count_24h ?? row.publishers ?? null,
    evidence: bp?.evidence_strength ?? row.evidence ?? null,
    meme: bp?.meme_potential ?? bp?.remixability ?? row.meme ?? null,
  };
}

export function rankTrends(rows: TrendInput[]) {
  return rows
    .map((row) => {
      const normalized = normalizeTrend(row);
      return { ...normalized, model: scoreTrend(normalized) };
    })
    .sort((a, b) => {
      if (a.model.status === "UNVERIFIED" && b.model.status !== "UNVERIFIED") return 1;
      if (b.model.status === "UNVERIFIED" && a.model.status !== "UNVERIFIED") return -1;
      return b.model.hype_score - a.model.hype_score;
    });
}
