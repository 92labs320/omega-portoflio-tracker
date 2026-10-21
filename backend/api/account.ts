import { getDb, route } from '../lib/http.js';
import { deleteAll, ownerFromAuthHeader } from '../lib/core.js';

/** DELETE /api/account → removes every row of this device from Neon. */
export default route(['DELETE'], async (req, res) => {
  const owner = ownerFromAuthHeader(req.headers.authorization);
  const deleted = await deleteAll(getDb(), owner);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ deleted });
});
