declare module '@dasl/tiles/loader' {
  export class TileMothership {
    constructor(conf?: { loadDomain?: string });
    init(): void;
    addLoader(loader: unknown): void;
    removeLoader(loader: unknown): void;
    getLoadSource(): string;
    loadTile(url: string): Promise<Tile | false>;
    registerShuttleFrame(ifr: HTMLIFrameElement, tile: Tile): string;
    startShuttle(id: string): void;
    sendToShuttle(id: string, action: string, payload: unknown): void;
  }
  export class Tile extends EventTarget {
    get url(): string;
    get manifest(): TileManifest;
    renderCard(options?: { contentHeight?: number }): Promise<HTMLElement>;
    renderContent(height?: number): HTMLIFrameElement;
    getLoadSource(): string;
    attachIframe(ifr: HTMLIFrameElement): void;
    resolvePath(path: string): Promise<{
      ok: boolean;
      status: number;
      headers?: Record<string, string>;
      body?: ArrayBuffer;
    }>;
  }
  export interface TileManifest {
    name?: string;
    description?: string;
    icons?: Array<{ src: string }>;
    screenshots?: Array<{ src: string }>;
    sizing?: { width?: number; height?: number };
    resources?: Record<string, unknown>;
  }
}
declare module '@dasl/tiles/loader/at' {
  export class ATTileLoader {
    load(url: string, mothership: unknown): Promise<unknown>;
  }
}
