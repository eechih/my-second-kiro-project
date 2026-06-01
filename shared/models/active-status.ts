export const ACTIVE_STATUS = {
  active: "ACTIVE",
  inactive: "INACTIVE",
} as const;

export type ActiveStatusKey =
  (typeof ACTIVE_STATUS)[keyof typeof ACTIVE_STATUS];

export function toActiveStatusKey(isActive: boolean): ActiveStatusKey {
  return isActive ? ACTIVE_STATUS.active : ACTIVE_STATUS.inactive;
}
