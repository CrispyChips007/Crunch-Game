export function secureDie() {
  if (!globalThis.crypto?.getRandomValues) throw new Error("Secure dice rolls require the Web Crypto API.");
  const value = new Uint32Array(1);
  const limit = 0x100000000 - (0x100000000 % 6);
  do globalThis.crypto.getRandomValues(value); while (value[0] >= limit);
  return (value[0] % 6) + 1;
}

export function rollDice(count, dieRoller = secureDie) {
  return Array.from({ length: count }, dieRoller);
}
