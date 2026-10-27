import { P1 } from './part1';
import { P2 } from './part2';
import { P3 } from './part3';
import { P4 } from './part4';
import { P5 } from './part5';

/** English text → [cs, sk, pl, de, es, fr, it, pt, uk] */
export const STRINGS: Record<string, string[]> = { ...P1, ...P2, ...P3, ...P4, ...P5 };
