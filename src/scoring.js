const SINGLE_POINTS = { 1: 100, 5: 50 };

export function countDice(dice) {
  const counts = Array(7).fill(0);
  for (const die of dice) counts[die] += 1;
  return counts;
}

export function scoreSelection(dice) {
  if (!Array.isArray(dice) || dice.length === 0 || dice.some((d) => !Number.isInteger(d) || d < 1 || d > 6)) {
    return { valid: false, score: 0, reason: "Select at least one scoring die." };
  }
  const counts = countDice(dice);
  let score = 0;
  for (let face = 1; face <= 6; face += 1) {
    const count = counts[face];
    if (!count) continue;
    if (face === 1 || face === 5) {
      if (count >= 3) score += face === 1 ? 1000 : 500;
      score += Math.max(0, count - 3) * SINGLE_POINTS[face];
      if (count < 3) score += count * SINGLE_POINTS[face];
    } else if (count === 3) {
      score += face * 100;
    } else {
      return { valid: false, score: 0, reason: `${face}s score only as an exact group of three.` };
    }
  }
  return { valid: true, score };
}

export function scoringOptions(dice) {
  const counts = countDice(dice);
  const options = [];
  dice.forEach((face, index) => {
    if (face === 1 || face === 5) options.push({ type: "single", face, indices: [index], score: SINGLE_POINTS[face] });
  });
  for (let face = 1; face <= 6; face += 1) {
    if (counts[face] >= 3) {
      const indices = dice.map((d, i) => d === face ? i : -1).filter((i) => i >= 0).slice(0, 3);
      options.push({ type: "triple", face, indices, score: face === 1 ? 1000 : face * 100 });
    }
  }
  return options;
}

export function isCrunch(dice) {
  return scoringOptions(dice).length === 0;
}
