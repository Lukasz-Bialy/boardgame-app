// Szczegóły meczu do analizy na żądanie: pełne statystyki + oś czasu (2 zapytania Riot API na mecz).
// Zakończony mecz się nie zmienia, więc raz pobrane szczegóły zostają w bazie na stałe.

import { cacheGet, cacheSet, riot, RiotError } from "./riot";
import type { DetailEvent, DetailMatch, DetailPlayer } from "./match-analysis";

const DETAIL_VERSION = 1;

type RawChallenges = Partial<{
  soloKills: number;
  turretPlatesTaken: number;
  dragonTakedowns: number;
  baronTakedowns: number;
  riftHeraldTakedowns: number;
  visionScoreAdvantageLaneOpponent: number;
  killParticipation: number;
  teamDamagePercentage: number;
  damageTakenOnTeamPercentage: number;
  controlWardsPlaced: number;
  wardTakedowns: number;
  skillshotsDodged: number;
  skillshotsHit: number;
  saveAllyFromDeath: number;
  enemyChampionImmobilizations: number;
  effectiveHealAndShielding: number;
}>;

type RawDetailParticipant = {
  participantId: number;
  puuid: string;
  teamId: number;
  teamPosition: string;
  championName: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  goldEarned: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  totalDamageDealtToChampions: number;
  totalDamageTaken: number;
  visionScore: number;
  wardsPlaced: number;
  wardsKilled: number;
  detectorWardsPlaced: number;
  totalTimeSpentDead: number;
  damageDealtToObjectives: number;
  turretTakedowns: number;
  firstBloodKill: boolean;
  firstBloodAssist: boolean;
  gameEndedInEarlySurrender: boolean;
  challenges?: RawChallenges;
};

type RawDetailMatch = {
  metadata: { matchId: string };
  info: {
    queueId: number;
    gameMode: string;
    gameDuration: number;
    gameEndTimestamp: number;
    participants: RawDetailParticipant[];
    teams: { teamId: number; win: boolean; objectives: Record<string, { first: boolean; kills: number }> }[];
  };
};

type RawFrame = {
  timestamp: number;
  participantFrames: Record<
    string,
    { totalGold: number; xp: number; minionsKilled: number; jungleMinionsKilled: number; position?: { x: number; y: number } }
  >;
  events: {
    type: string;
    timestamp: number;
    killerId?: number;
    victimId?: number;
    assistingParticipantIds?: number[];
    position?: { x: number; y: number };
    killerTeamId?: number;
    monsterType?: string;
    monsterSubType?: string;
    teamId?: number;
    buildingType?: string;
    laneType?: string;
    towerType?: string;
  }[];
};

type RawTimeline = { info: { frames: RawFrame[] } };

function trimDetail(m: RawDetailMatch, tl: RawTimeline): DetailMatch {
  const players: DetailPlayer[] = [...m.info.participants]
    .sort((a, b) => a.participantId - b.participantId)
    .map((p) => {
      const c = p.challenges ?? {};
      return {
        pid: p.participantId,
        puuid: p.puuid,
        teamId: p.teamId,
        position: p.teamPosition,
        champion: p.championName,
        win: p.win,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        gold: p.goldEarned,
        cs: p.totalMinionsKilled + p.neutralMinionsKilled,
        damage: p.totalDamageDealtToChampions,
        damageTaken: p.totalDamageTaken,
        vision: p.visionScore,
        wardsPlaced: p.wardsPlaced,
        wardsKilled: p.wardsKilled,
        controlWards: c.controlWardsPlaced ?? p.detectorWardsPlaced,
        timeDead: p.totalTimeSpentDead,
        objDamage: p.damageDealtToObjectives,
        turretTakedowns: p.turretTakedowns,
        firstBlood: p.firstBloodKill || p.firstBloodAssist,
        soloKills: c.soloKills ?? 0,
        plates: c.turretPlatesTaken ?? 0,
        epicTakedowns: (c.dragonTakedowns ?? 0) + (c.baronTakedowns ?? 0) + (c.riftHeraldTakedowns ?? 0),
        kp: c.killParticipation ?? 0,
        dmgPct: c.teamDamagePercentage ?? 0,
        takenPct: c.damageTakenOnTeamPercentage ?? 0,
        skillshotsDodged: c.skillshotsDodged ?? 0,
        skillshotsHit: c.skillshotsHit ?? 0,
      };
    });

  const events: DetailEvent[] = [];
  for (const f of tl.info.frames) {
    for (const e of f.events) {
      if (e.type === "CHAMPION_KILL" && e.victimId) {
        events.push({
          k: "kill",
          t: e.timestamp,
          killer: e.killerId ?? 0,
          victim: e.victimId,
          assists: e.assistingParticipantIds ?? [],
          x: e.position?.x ?? 0,
          y: e.position?.y ?? 0,
        });
      } else if (e.type === "ELITE_MONSTER_KILL" && e.killerTeamId) {
        events.push({ k: "monster", t: e.timestamp, team: e.killerTeamId, type: e.monsterType ?? "", sub: e.monsterSubType });
      } else if (e.type === "BUILDING_KILL" && e.teamId) {
        // teamId w zdarzeniu to drużyna, która budynek STRACIŁA
        events.push({ k: "building", t: e.timestamp, lost: e.teamId, type: e.buildingType ?? "", lane: e.laneType });
      }
    }
  }

  return {
    v: DETAIL_VERSION,
    id: m.metadata.matchId,
    queueId: m.info.queueId,
    gameMode: m.info.gameMode,
    duration: m.info.gameDuration,
    endedAt: m.info.gameEndTimestamp,
    remake: m.info.participants.some((p) => p.gameEndedInEarlySurrender),
    teams: m.info.teams.map((t) => ({ teamId: t.teamId, win: t.win, objectives: t.objectives })),
    players,
    // [złoto, xp, cs, x, y] na każdą minutę, w kolejności participantId
    frames: tl.info.frames.map((f) =>
      players.map((p) => {
        const pf = f.participantFrames[String(p.pid)];
        return pf
          ? [pf.totalGold, pf.xp, pf.minionsKilled + pf.jungleMinionsKilled, pf.position?.x ?? 0, pf.position?.y ?? 0]
          : [0, 0, 0, 0, 0];
      })
    ),
    events,
  };
}

export type DetailFetch = { matches: DetailMatch[]; missing: string[]; rateLimited: boolean };

// Szczegóły meczów z cache albo z Riot API. Po trafieniu na limit zapytań reszta zostaje na później.
export async function getMatchDetails(ids: string[]): Promise<DetailFetch> {
  const matches: DetailMatch[] = [];
  const missing: string[] = [];
  let rateLimited = false;

  const cached = await Promise.all(ids.map((id) => cacheGet<DetailMatch>(`detail:${id}`)));
  const todo: string[] = [];
  ids.forEach((id, i) => {
    const c = cached[i]?.data;
    if (c && c.v === DETAIL_VERSION) matches.push(c);
    else todo.push(id);
  });

  await Promise.all(
    todo.map(async (id) => {
      if (rateLimited) return missing.push(id);
      try {
        const [m, tl] = await Promise.all([
          riot<RawDetailMatch>(`/lol/match/v5/matches/${id}`),
          riot<RawTimeline>(`/lol/match/v5/matches/${id}/timeline`),
        ]);
        const d = trimDetail(m, tl);
        await cacheSet(`detail:${id}`, d);
        matches.push(d);
      } catch (e) {
        if (e instanceof RiotError && e.status === 429) rateLimited = true;
        else console.warn(`Riot: nie pobrano szczegółów meczu ${id}:`, e instanceof Error ? e.message : e);
        missing.push(id);
      }
    })
  );

  const order = new Map(ids.map((id, i) => [id, i]));
  matches.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  return { matches, missing, rateLimited };
}
