export type Deep0 = { next: Deep1 };
export type Deep1 = { next: Deep2 };
export type Deep2 = { next: Deep3 };
export type Deep3 = { next: Deep4 };
export type Deep4 = { next: Deep5 };
export type Deep5 = { next: Deep6 };
export type Deep6 = { next: Deep7 };
export type Deep7 = { next: Deep8 };
export type Deep8 = { next: Deep9 };
export type Deep9 = { done: boolean };

export class DeepConsumer {
  value: Deep0;
}
