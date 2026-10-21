import { getDb, route } from '../lib/http.js';
import { ownerFromAuthHeader, sync } from '../lib/core.js';

/** POST /api/sync  { cursor, changes[] } → { cursor, hasMore, rows[] } */
export default route(['POST'], async (req, res) => {
  const owner = ownerFromAuthHeader(req.headers.authorization);
  const result = await sync(getDb(), owner, req.body);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(result);
});
