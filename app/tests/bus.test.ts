import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { bikeStation, busDepartures, busName, busTime, busWait, busWaits } from "../src/bus.ts";

// A made-up stop: the real one is a secret of the sensor.
const row = (line: string, to: string, at: string) => ({
  properties: { nom_station: "PLACE DE LA GARE", code_ligne: line, sens_ligne: to, heure_estimee_depart: at },
});
const now = new Date(2026, 10, 7, 17, 12, 0); // 17:12, local time

describe("busName", () => {
  test("French title case", () => {
    assert.equal(busName("PLACE DE LA GARE"), "Place de la Gare");
    assert.equal(busName("ST. D'EXEMPLE HOTEL DE VILLE"), "St. d'Exemple Hotel de Ville");
    assert.equal(busName("LILLE L'ARBONNOISE"), "Lille l'Arbonnoise");
    assert.equal(busName("MARCQ-EN-BAROEUL"), "Marcq-en-Baroeul");
    assert.equal(busName("DE GAULLE"), "De Gaulle");
  });
});

describe("busTime", () => {
  test("the trailing Z is ignored: Ilévia's times are local", () => {
    const d = busTime("2026-11-07T17:20:42Z")!;
    assert.deepEqual([d.getHours(), d.getMinutes(), d.getSeconds()], [17, 20, 42]);
  });

  test("garbage gives nothing", () => {
    assert.equal(busTime(""), undefined);
    assert.equal(busTime("bientôt"), undefined);
  });
});

describe("busDepartures", () => {
  test("the stop from the rows, one row per line and direction, soonest first", () => {
    const features = [
      row("L10", "GARE NORD", "2026-11-07T17:23:29Z"),
      row("L10", "GARE NORD", "2026-11-07T17:11:12Z"), // 48 s ago: still « à l'arrêt »
      row("L10", "GARE NORD", "2026-11-07T17:05:00Z"), // gone
      row("9", "CENTRE", "2026-11-07T17:25:26Z"),
      row("L10", "ZONE SUD", "2026-11-07T17:40:00Z"),
    ];
    const { stop, rows } = busDepartures(features, now);
    assert.equal(stop, "Place de la Gare");
    assert.deepEqual(rows.map((r) => [r.line, r.to, r.at.map((d) => d.getMinutes())]), [
      ["9", "Centre", [25]],
      ["L10", "Gare Nord", [11, 23]],
      ["L10", "Zone Sud", [40]],
    ]);
  });

  test("no data (sensor unavailable, attribute missing, only past buses)", () => {
    assert.deepEqual(busDepartures(undefined, now), { stop: undefined, rows: [] });
    assert.deepEqual(busDepartures([row("9", "CENTRE", "2026-11-07T16:00:00Z")], now).rows, []);
  });
});

describe("busWait", () => {
  const fmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
  test("minutes, then the time from an hour on", () => {
    assert.equal(busWait(new Date(2026, 10, 7, 17, 12, 40), now, fmt), "à l'arrêt");
    assert.equal(busWait(new Date(2026, 10, 7, 17, 13, 5), now, fmt), "1 min");
    assert.equal(busWait(new Date(2026, 10, 7, 17, 24, 0), now, fmt), "12 min");
    assert.equal(busWait(new Date(2026, 10, 7, 18, 30, 0), now, fmt), "18:30");
  });

  test("two waits, min written once", () => {
    const at = (h: number, m: number) => new Date(2026, 10, 7, h, m, 0);
    assert.deepEqual(busWaits([at(17, 17), at(17, 23), at(17, 40)], now, fmt), ["5", "11 min"]);
    assert.deepEqual(busWaits([new Date(2026, 10, 7, 17, 12, 30), at(17, 23)], now, fmt), ["à l'arrêt", "11 min"]);
    assert.deepEqual(busWaits([at(17, 52), at(18, 30)], now, fmt), ["40 min", "18:30"]);
    assert.deepEqual(busWaits([at(17, 17)], now, fmt), ["5 min"]);
  });
});

describe("bikeStation", () => {
  const vl = (state: string, attributes: Record<string, unknown>) => ({ state, attributes });
  const base = { nom: "Place de la Gare", nb_places_dispo: 9, etat: "EN SERVICE", etat_connexion: "CONNECTÉ" };
  test("in service: bikes and free docks", () => {
    assert.deepEqual(bikeStation(vl("7", base)), { name: "Place de la Gare", bikes: 7, docks: 9, ok: true });
  });
  test("out of service or disconnected: no counts", () => {
    assert.equal(bikeStation(vl("7", { ...base, etat: "RÉFORMÉ" }))?.ok, false);
    assert.equal(bikeStation(vl("7", { ...base, etat_connexion: "DÉCONNECTÉ" }))?.ok, false);
    assert.equal(bikeStation(vl("unavailable", base))?.ok, false);
  });
  test("no sensor, or not loaded yet", () => {
    assert.equal(bikeStation(undefined), undefined);
    assert.equal(bikeStation(vl("unknown", {})), undefined);
  });
});
