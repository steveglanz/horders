/** In-run quests: three are picked at the start of each run. */
export type QuestId = 'hounds' | 'ashmaw' | 'rifts' | 'veins';

export interface QuestDef {
  id: QuestId;
  name: string;
  text: string;
  goal: number;
}

export const QUESTS: Record<QuestId, QuestDef> = {
  hounds: { id: 'hounds', name: 'Thin the Pack', text: 'Slay Cinderhounds', goal: 60 },
  ashmaw: { id: 'ashmaw', name: 'The Glutton', text: 'Slay the Taster', goal: 1 },
  rifts: { id: 'rifts', name: 'Seal the Breach', text: 'Close Hollow Rifts', goal: 3 },
  veins: { id: 'veins', name: 'Ember Harvest', text: 'Gather Ember Veins', goal: 5 },
};
