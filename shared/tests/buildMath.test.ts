import { describe, expect, it } from "vitest";
import {
  abilityHasteToCdr,
  computeBuildStats,
  cooldownWithAbilityHaste,
  emptyProfile,
  growthFactor,
  statAtLevel,
  statsAtLevel,
  sumFlatStats,
} from "../src/buildMath.js";
import type { FlatStatMap } from "../src/types.js";

describe("growthFactor / statAtLevel", () => {
  it("en nivel 1 el factor es 0 y el stat es exactamente la base", () => {
    expect(growthFactor(1)).toBe(0);
    expect(statAtLevel(650, 104, 1)).toBe(650);
  });

  it("en nivel 18 el factor es exactamente 17 (curva Riot)", () => {
    // 17 × (0.7025 + 0.0175×17) = 17 × 1 = 17
    expect(growthFactor(18)).toBeCloseTo(17, 10);
    expect(statAtLevel(100, 10, 18)).toBeCloseTo(100 + 10 * 17, 10);
  });

  it("en nivel 20 aplica la fórmula no lineal completa", () => {
    const expectedFactor = 19 * (0.7025 + 0.0175 * 19);
    expect(growthFactor(20)).toBeCloseTo(expectedFactor, 10);
    expect(statAtLevel(500, 90, 20)).toBeCloseTo(500 + 90 * expectedFactor, 10);
  });

  it("coincide con la fórmula expandida Base + Growth×(L−1)×(0.7025+0.0175×(L−1))", () => {
    const base = 580;
    const growth = 101;
    for (const level of [1, 2, 5, 10, 18, 20]) {
      const steps = level - 1;
      const expected = base + growth * steps * (0.7025 + 0.0175 * steps);
      expect(statAtLevel(base, growth, level)).toBeCloseTo(expected, 10);
    }
  });

  it("growth 0 deja el stat en la base a cualquier nivel", () => {
    expect(statAtLevel(40, 0, 18)).toBe(40);
  });
});

describe("statsAtLevel", () => {
  const base: FlatStatMap = {
    hp: 650,
    armor: 30,
    attackDamage: 60,
    abilityPower: 0,
  };
  const perLevel: FlatStatMap = {
    hp: 104,
    armor: 4.2,
    attackDamage: 3.5,
  };

  it("nivel 1 iguala las bases (sin growth aplicado)", () => {
    const result = statsAtLevel(base, perLevel, 1);
    expect(result.hp).toBe(650);
    expect(result.armor).toBe(30);
    expect(result.attackDamage).toBe(60);
  });

  it("nivel 18 aplica growth × 17 a cada clave con perLevel", () => {
    const result = statsAtLevel(base, perLevel, 18);
    expect(result.hp).toBeCloseTo(650 + 104 * 17, 10);
    expect(result.armor).toBeCloseTo(30 + 4.2 * 17, 10);
    expect(result.attackDamage).toBeCloseTo(60 + 3.5 * 17, 10);
  });

  it("incluye claves solo presentes en perLevel con base 0", () => {
    const result = statsAtLevel({}, { abilityPower: 5 }, 18);
    expect(result.abilityPower).toBeCloseTo(5 * 17, 10);
  });
});

describe("sumFlatStats", () => {
  it("suma mods planos de varios ítems", () => {
    const sum = sumFlatStats(
      { hp: 400, abilityHaste: 15 },
      { attackDamage: 40, abilityHaste: 20 },
      { hp: 200 },
    );
    expect(sum).toEqual({
      hp: 600,
      attackDamage: 40,
      abilityHaste: 35,
    });
  });

  it("devuelve objeto vacío si no hay aportes", () => {
    expect(sumFlatStats({}, {})).toEqual({});
  });
});

describe("abilityHasteToCdr", () => {
  it("AH 0 → CDR 0%", () => {
    expect(abilityHasteToCdr(0)).toEqual({ ratio: 0, percent: 0 });
  });

  it("AH 100 → CDR exacto 50%", () => {
    const cdr = abilityHasteToCdr(100);
    expect(cdr.ratio).toBeCloseTo(0.5, 12);
    expect(cdr.percent).toBeCloseTo(50, 12);
  });

  it("AH 200 → CDR = 200/300 ≈ 66.666…%", () => {
    const cdr = abilityHasteToCdr(200);
    expect(cdr.ratio).toBeCloseTo(200 / 300, 12);
    expect(cdr.percent).toBeCloseTo((200 / 300) * 100, 12);
  });

  it("AH 10 → CDR = 10/110", () => {
    const cdr = abilityHasteToCdr(10);
    expect(cdr.ratio).toBeCloseTo(10 / 110, 12);
    expect(cdr.percent).toBeCloseTo((10 / 110) * 100, 12);
  });

  it("valores negativos o no finitos se tratan como 0", () => {
    expect(abilityHasteToCdr(-50)).toEqual({ ratio: 0, percent: 0 });
    expect(abilityHasteToCdr(Number.NaN)).toEqual({ ratio: 0, percent: 0 });
  });
});

describe("cooldownWithAbilityHaste", () => {
  it("sin AH el CD base no cambia", () => {
    expect(cooldownWithAbilityHaste(10, 0)).toBe(10);
  });

  it("AH 100 reduce el CD a la mitad", () => {
    expect(cooldownWithAbilityHaste(10, 100)).toBeCloseTo(5, 12);
  });

  it("coincide con base × (1 − ratio CDR)", () => {
    const base = 12;
    const ah = 50;
    const { ratio } = abilityHasteToCdr(ah);
    expect(cooldownWithAbilityHaste(base, ah)).toBeCloseTo(
      base * (1 - ratio),
      12,
    );
  });
});

describe("computeBuildStats", () => {
  const profile = emptyProfile(
    "Ahri",
    {
      hp: 590,
      mp: 418,
      armor: 21,
      spellBlock: 30,
      attackDamage: 53,
      attackSpeed: 0.668,
      moveSpeed: 330,
      crit: 0,
      hpRegen: 2.5,
      mpRegen: 8,
    },
    {
      hp: 96,
      mp: 25,
      armor: 4.7,
      spellBlock: 1.3,
      attackDamage: 3,
    },
  );

  it("nivel 1 sin ítems: fromLevel = bases, CDR 0, total = fromLevel", () => {
    const build = computeBuildStats({
      profile,
      level: 1,
      itemStats: [],
      itemIds: [],
    });

    expect(build.level).toBe(1);
    expect(build.championId).toBe("Ahri");
    expect(build.itemIds).toEqual([]);
    expect(build.fromLevel.hp).toBe(590);
    expect(build.fromItems).toEqual({});
    expect(build.total.hp).toBe(590);
    expect(build.abilityHaste).toBe(0);
    expect(build.cooldownReduction).toEqual({ ratio: 0, percent: 0 });
  });

  it("nivel 18 sin ítems usa la curva × 17", () => {
    const build = computeBuildStats({
      profile,
      level: 18,
      itemStats: [],
    });

    expect(build.level).toBe(18);
    expect(build.fromLevel.hp).toBeCloseTo(590 + 96 * 17, 10);
    expect(build.fromLevel.armor).toBeCloseTo(21 + 4.7 * 17, 10);
    expect(build.total.hp).toBe(build.fromLevel.hp);
  });

  it("nivel 20 soporta modos flexibles (máximo del rango)", () => {
    const build = computeBuildStats({
      profile,
      level: 20,
      itemStats: [],
    });
    const factor = 19 * (0.7025 + 0.0175 * 19);
    expect(build.level).toBe(20);
    expect(build.fromLevel.hp).toBeCloseTo(590 + 96 * factor, 10);
  });

  it("suma ítems planos + AH→CDR en el total", () => {
    const build = computeBuildStats({
      profile,
      level: 10,
      itemStats: [
        { hp: 400, abilityHaste: 15, armor: 40 },
        { attackDamage: 55, abilityHaste: 25 },
        { abilityPower: 80, abilityHaste: 20 },
      ],
      itemIds: ["3083", "3031", "3089"],
    });

    expect(build.itemIds).toEqual(["3083", "3031", "3089"]);
    expect(build.fromItems.hp).toBe(400);
    expect(build.fromItems.attackDamage).toBe(55);
    expect(build.fromItems.abilityPower).toBe(80);
    expect(build.fromItems.abilityHaste).toBe(60);
    expect(build.abilityHaste).toBe(60);

    const expectedFromLevelHp = statAtLevel(590, 96, 10);
    expect(build.fromLevel.hp).toBeCloseTo(expectedFromLevelHp, 10);
    expect(build.total.hp).toBeCloseTo(expectedFromLevelHp + 400, 10);
    expect(build.total.armor).toBeCloseTo(
      statAtLevel(21, 4.7, 10) + 40,
      10,
    );

    const cdr = abilityHasteToCdr(60);
    expect(build.cooldownReduction.ratio).toBeCloseTo(cdr.ratio, 12);
    expect(build.cooldownReduction.percent).toBeCloseTo(cdr.percent, 12);
    expect(build.cooldownReduction.percent).toBeCloseTo((60 / 160) * 100, 12);
  });

  it("clampa niveles fuera de rango a [1, 20]", () => {
    expect(
      computeBuildStats({ profile, level: 0, itemStats: [] }).level,
    ).toBe(1);
    expect(
      computeBuildStats({ profile, level: 99, itemStats: [] }).level,
    ).toBe(20);
    expect(
      computeBuildStats({ profile, level: 12.9, itemStats: [] }).level,
    ).toBe(12);
  });

  it("no aplica percentBonuses (v1 solo planos): el caller solo pasa FlatStatMap", () => {
    const build = computeBuildStats({
      profile,
      level: 1,
      itemStats: [{ attackDamage: 40 }],
    });
    // Si alguien pasara un % por error como flat, se sumaría; el contrato
    // es que el BFF ya separó percentBonuses. Aquí solo verificamos suma plana.
    expect(build.total.attackDamage).toBe(53 + 40);
  });
});
