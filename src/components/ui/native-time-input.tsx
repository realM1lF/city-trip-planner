import * as React from "react";
import { cn } from "@/lib/utils";

/** Natives input type="time" — ohne Base-UI-FieldControl (sonst oft keine zuverlässige Synchronisation mit dem Store). */
const nativeTimeInputClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

export const NativeTimeInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(function NativeTimeInput({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="time"
      data-slot="input-native-time"
      className={cn(nativeTimeInputClassName, className)}
      {...props}
    />
  );
});
