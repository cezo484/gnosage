// Watcher (v1): discovers newly deployed realms on the testnet so the
// agent can review them without a hand-written queue.
//
// Approach: poll the RPC tx_search endpoint for AddPackage messages
// (message.action='/vm.m_addpkg'), newest blocks first, and extract the
// deployed package paths. The watcher keeps a cursor file (last seen
// height) so each run only covers new blocks.
//
// Status: stub for week 2. The week-1 agent reviews paths from queue.txt
// (see cli.ts `run`) and single paths (cli.ts `review`).
export interface WatcherCursor {
  lastHeight: number;
}

export function loadCursor(_path: string): WatcherCursor {
  return { lastHeight: 0 };
}

export async function discoverNewRealms(_rpcUrl: string, _fromHeight: number): Promise<string[]> {
  throw new Error("watcher not implemented yet (week 2)");
}
