import { cn } from "@/lib/utils";

const sizes = {
  sm: "size-[18px] border-2",
  md: "size-9 border-2",
  lg: "size-[4.5rem] border-[2.5px]",
} as const;

export function CallingRing({
  size = "sm",
  className,
  label = "Calling in progress",
}: {
  size?: keyof typeof sizes;
  className?: string;
  /** Visually hidden accessibility label */
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block shrink-0 rounded-full border-zinc-600/35 border-t-zinc-300/90 animate-spin",
        sizes[size],
        className
      )}
      role="status"
      aria-label={label}
    />
  );
}
