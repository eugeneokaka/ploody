export const TODO_COLORS = [
  "yellow",
  "pink",
  "blue",
  "green",
  "purple",
  "orange",
] as const;

export type TodoColor = (typeof TODO_COLORS)[number];

export const TODO_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export type TodoPriorityValue = (typeof TODO_PRIORITIES)[number];

export const TODO_COLOR_LABELS: Record<TodoColor, string> = {
  yellow: "Sunshine",
  pink: "Bubblegum",
  blue: "Daydream",
  green: "Fresh mint",
  purple: "Grape soda",
  orange: "Peach fizz",
};

export function isTodoColor(value: unknown): value is TodoColor {
  return (
    typeof value === "string" &&
    (TODO_COLORS as readonly string[]).includes(value)
  );
}

export function isTodoPriority(value: unknown): value is TodoPriorityValue {
  return (
    typeof value === "string" &&
    (TODO_PRIORITIES as readonly string[]).includes(value)
  );
}
