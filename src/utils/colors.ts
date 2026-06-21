import { User } from '@/types';

export const USER_COLORS = [
  'red', 'pink', 'grape', 'violet', 'indigo', 'blue', 'cyan', 'teal', 'green', 'lime', 'orange',
] as const;

/** 既存ユーザーの色を考慮して最も使われていない色を返す */
export function pickColor(existingUsers: User[]): string {
  const usedColors = existingUsers.map((u) => u.color);
  const unused = USER_COLORS.filter((c) => !usedColors.includes(c));
  if (unused.length > 0) return unused[0];

  let minCount = Infinity;
  let minColor: string = USER_COLORS[0];
  for (const color of USER_COLORS) {
    const count = usedColors.filter((c) => c === color).length;
    if (count < minCount) {
      minCount = count;
      minColor = color;
    }
  }
  return minColor;
}
