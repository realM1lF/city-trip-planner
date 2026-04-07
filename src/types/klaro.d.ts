declare module "klaro" {
  export interface ConsentWatcher {
    update(manager: ConsentManager, name: string, data?: unknown): void;
  }

  export interface ConsentManager {
    confirmed: boolean;
    watch(watcher: ConsentWatcher): void;
    unwatch(watcher: ConsentWatcher): void;
    getConsent(name: string): boolean;
  }

  export interface RenderOptions {
    show?: boolean;
    modal?: boolean;
    testing?: boolean;
    api?: unknown;
  }

  export function getManager(config: unknown): ConsentManager;
  export function render(config: unknown, opts?: RenderOptions): unknown;
  export function show(config?: unknown, modal?: boolean): boolean;
}
