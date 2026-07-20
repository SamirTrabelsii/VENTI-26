import { GROUP_MATCHES, KNOCKOUT_MATCHES, getTeam } from "@/lib/wc2026-data";

export type KnockoutRound =
  "r32" | "r16" | "qf" | "sf" | "third_place" | "final";

export type LiveApiMatch = {
  id?: number | string;
  utcDate?: string;
  status?: string;
  stage?: string;
  homeTeam?: { name?: string; tla?: string; shortName?: string };
  awayTeam?: { name?: string; tla?: string; shortName?: string };
  score?: { fullTime?: { home?: number | null; away?: number | null } };
};

export type LiveBracketFixture = {
  id: string;
  round: KnockoutRound;
  slotIndex: number;
  matchNumber: number;
  label: string;
  pathLabel: string;
  kickoff: string;
  venue: string;
  city: string;
  homeCode: string;
  awayCode: string;
  homeSeed: string;
  awaySeed: string;
  status: string;
  apiStatus?: string;
  source: "api" | "db" | "template";
  homeScore: number | null;
  awayScore: number | null;
};

export const STAGE_TO_GROUP_LABEL: Record<string, string> = {
  LAST_32: "R32",
  ROUND_OF_32: "R32",
  R32: "R32",
  LAST_16: "R16",
  ROUND_OF_16: "R16",
  R16: "R16",
  QUARTER_FINALS: "QF",
  QUARTER_FINAL: "QF",
  QF: "QF",
  SEMI_FINALS: "SF",
  SEMI_FINAL: "SF",
  SF: "SF",
  THIRD_PLACE: "3RD",
  THIRD_PLACE_PLAYOFF: "3RD",
  "3RD": "3RD",
  FINAL: "FINAL",
};

export const NAME_TO_CODE: Record<string, string> = {
  Mexico: "MEX",
  "South Africa": "RSA",
  "Korea Republic": "KOR",
  "South Korea": "KOR",
  Czechia: "CZE",
  "Czech Republic": "CZE",
  Canada: "CAN",
  "Bosnia-Herzegovina": "BIH",
  "Bosnia and Herzegovina": "BIH",
  "United States": "USA",
  Paraguay: "PAR",
  Qatar: "QAT",
  Switzerland: "SUI",
  Brazil: "BRA",
  Morocco: "MAR",
  Haiti: "HAI",
  Scotland: "SCO",
  Australia: "AUS",
  Turkey: "TUR",
  Germany: "GER",
  Curaçao: "CUW",
  Curacao: "CUW",
  Netherlands: "NED",
  Japan: "JPN",
  "Ivory Coast": "CIV",
  "Côte d'Ivoire": "CIV",
  "CÃ´te d'Ivoire": "CIV",
  Ecuador: "ECU",
  Sweden: "SWE",
  Tunisia: "TUN",
  Spain: "ESP",
  "Cape Verde Islands": "CPV",
  "Cape Verde": "CPV",
  Belgium: "BEL",
  Egypt: "EGY",
  "Saudi Arabia": "KSA",
  Uruguay: "URU",
  Iran: "IRN",
  "New Zealand": "NZL",
  France: "FRA",
  Senegal: "SEN",
  Iraq: "IRQ",
  Norway: "NOR",
  Argentina: "ARG",
  Algeria: "ALG",
  Austria: "AUT",
  Jordan: "JOR",
  Portugal: "POR",
  "DR Congo": "COD",
  "Congo DR": "COD",
  "Democratic Republic of the Congo": "COD",
  Uzbekistan: "UZB",
  Colombia: "COL",
  England: "ENG",
  Croatia: "CRO",
  Ghana: "GHA",
  Panama: "PAN",
};

export const OFFICIAL_NEXT_ROUND: Record<string, [string, string]> = {
  r16_1: ["r32_1", "r32_4"],
  r16_2: ["r32_3", "r32_6"],
  r16_3: ["r32_2", "r32_5"],
  r16_4: ["r32_7", "r32_8"],
  r16_5: ["r32_12", "r32_11"],
  r16_6: ["r32_10", "r32_9"],
  r16_7: ["r32_15", "r32_14"],
  r16_8: ["r32_13", "r32_16"],
  qf_1: ["r16_2", "r16_1"],
  qf_2: ["r16_5", "r16_6"],
  qf_3: ["r16_3", "r16_4"],
  qf_4: ["r16_7", "r16_8"],
  sf_1: ["qf_1", "qf_2"],
  sf_2: ["qf_3", "qf_4"],
  final: ["sf_1", "sf_2"],
  third_place: ["sf_1", "sf_2"],
};

export function isKnownTeamCode(code?: string | null) {
  return !!code && !!getTeam(code);
}

export function roundSlotFromFixtureId(id: string): {
  round: KnockoutRound;
  slotIndex: number;
} {
  if (id === "final") return { round: "final", slotIndex: 0 };
  if (id === "third_place") return { round: "third_place", slotIndex: 0 };
  const match = id.match(/^([a-z0-9]+)_(\d+)$/);
  if (!match) throw new Error(`Invalid knockout fixture id: ${id}`);
  return { round: match[1] as KnockoutRound, slotIndex: Number(match[2]) - 1 };
}

export function fixtureIdFromRoundSlot(round: string, slotIndex: number) {
  if (round === "final" || round === "third_place") return round;
  return `${round}_${slotIndex + 1}`;
}

function apiCode(team?: { name?: string; tla?: string; shortName?: string }) {
  if (!team) return "TBD";
  return NAME_TO_CODE[team.name ?? ""] || team.tla || team.shortName || "TBD";
}

function localGroupLabelToRound(groupLabel: string): KnockoutRound {
  if (groupLabel === "R32") return "r32";
  if (groupLabel === "R16") return "r16";
  if (groupLabel === "QF") return "qf";
  if (groupLabel === "SF") return "sf";
  if (groupLabel === "3RD") return "third_place";
  return "final";
}

function displaySeed(seed: string) {
  return seed
    .replace("Winner Group ", "1")
    .replace("Runner-up Group ", "2")
    .replace(/^3rd Group .+$/, "Best 3rd")
    .replace(/^Winner Match /, "W")
    .replace(/^Loser Match /, "L");
}

function matchKnownApiByOfficialNumber(
  apiMatches: LiveApiMatch[],
  matchNumber: number,
) {
  return apiMatches.find((match) => String(match.id) === String(matchNumber));
}

export function buildLiveBracketFixtures(
  apiMatches: LiveApiMatch[],
  dbMatches: any[] = [],
): LiveBracketFixture[] {
  const apiByLocalId = new Map<string, LiveApiMatch>();

  for (const groupLabel of ["R32", "R16", "QF", "SF", "3RD", "FINAL"]) {
    const localFixtures = KNOCKOUT_MATCHES.filter(
      (match) => match.group_label === groupLabel,
    );
    const apiStageFixtures = apiMatches
      .filter((match) => STAGE_TO_GROUP_LABEL[match.stage ?? ""] === groupLabel)
      .sort(
        (a, b) =>
          new Date(a.utcDate ?? "").getTime() -
          new Date(b.utcDate ?? "").getTime(),
      );

    localFixtures.forEach((fixture, index) => {
      const apiByNumber = matchKnownApiByOfficialNumber(
        apiMatches,
        fixture.match_number,
      );
      const apiByOrder = apiStageFixtures[index];
      const apiMatch = apiByNumber || apiByOrder;
      if (apiMatch) apiByLocalId.set(fixture.id, apiMatch);
    });
  }

  const dbById = new Map(dbMatches.map((match) => [match.id, match]));

  return KNOCKOUT_MATCHES.map((fixture) => {
    const apiMatch = apiByLocalId.get(fixture.id);
    const dbMatch = dbById.get(fixture.id);
    const homeFromApi = apiCode(apiMatch?.homeTeam);
    const awayFromApi = apiCode(apiMatch?.awayTeam);
    const homeFromDb = dbMatch?.home_team;
    const awayFromDb = dbMatch?.away_team;

    const homeCode = isKnownTeamCode(homeFromApi)
      ? homeFromApi
      : isKnownTeamCode(homeFromDb)
        ? homeFromDb
        : "TBD";
    const awayCode = isKnownTeamCode(awayFromApi)
      ? awayFromApi
      : isKnownTeamCode(awayFromDb)
        ? awayFromDb
        : "TBD";
    const status = apiMatch?.status || dbMatch?.status || "SCHEDULED";

    return {
      id: fixture.id,
      ...roundSlotFromFixtureId(fixture.id),
      matchNumber: fixture.match_number,
      label: `Match ${fixture.match_number}`,
      pathLabel: `${displaySeed(fixture.home_team)} vs ${displaySeed(fixture.away_team)}`,
      kickoff: apiMatch?.utcDate || dbMatch?.kickoff || fixture.kickoff,
      venue: fixture.venue,
      city: fixture.city,
      homeCode,
      awayCode,
      homeSeed: fixture.home_team,
      awaySeed: fixture.away_team,
      status,
      apiStatus: apiMatch?.status,
      source:
        isKnownTeamCode(homeFromApi) || isKnownTeamCode(awayFromApi)
          ? "api"
          : isKnownTeamCode(homeFromDb) || isKnownTeamCode(awayFromDb)
            ? "db"
            : "template",
      homeScore: apiMatch?.score?.fullTime?.home ?? dbMatch?.home_score ?? null,
      awayScore: apiMatch?.score?.fullTime?.away ?? dbMatch?.away_score ?? null,
    };
  });
}

export function buildFinishedKnockoutWinners(fixtures: LiveBracketFixture[]) {
  const winners: Record<string, string> = {};
  for (const fixture of fixtures) {
    if (
      typeof fixture.homeScore !== "number" ||
      typeof fixture.awayScore !== "number"
    )
      continue;
    if (
      !isKnownTeamCode(fixture.homeCode) ||
      !isKnownTeamCode(fixture.awayCode)
    )
      continue;
    if (fixture.homeScore > fixture.awayScore)
      winners[fixture.id] = fixture.homeCode;
    if (fixture.awayScore > fixture.homeScore)
      winners[fixture.id] = fixture.awayCode;
  }
  return winners;
}

export function buildGroupFinishedCount(apiMatches: LiveApiMatch[]) {
  const finishedById = new Set<string>();
  for (const apiMatch of apiMatches) {
    if (apiMatch.stage !== "GROUP_STAGE" || apiMatch.status !== "FINISHED")
      continue;
    const homeCode = apiCode(apiMatch.homeTeam);
    const awayCode = apiCode(apiMatch.awayTeam);
    const local = GROUP_MATCHES.find(
      (match) => match.home_team === homeCode && match.away_team === awayCode,
    );
    if (local) finishedById.add(local.id);
  }
  return finishedById.size;
}
