/**
 * Tile Mothership singleton — initializes once for the app lifecycle.
 *
 * The TileMothership registers a global window message listener that relays
 * fetch requests between the tile iframe's Service Worker and the AT Protocol
 * loader. Only one instance should exist.
 */

import { TileMothership } from '@dasl/tiles/loader';
import type { Tile } from '@dasl/tiles/loader';
import { ATTileLoader } from '@dasl/tiles/loader/at';

let mothership: TileMothership | null = null;

export function getTileMothership(): TileMothership {
  if (!mothership) {
    mothership = new TileMothership({ loadDomain: 'load.webtil.es' });
    mothership.init();
    mothership.addLoader(new ATTileLoader());
  }
  return mothership;
}

export async function loadTile(uri: string): Promise<Tile | false> {
  return getTileMothership().loadTile(uri);
}
