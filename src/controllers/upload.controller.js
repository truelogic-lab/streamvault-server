import { supabase } from '../lib/supabase.js';

const ALLOWED_BUCKETS = ['posters', 'backdrops'];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

function safeName(name) {
  const ext = (name.split('.').pop() || 'jpg').toLowerCase();
  const base = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  return `${base}.${ext}`;
}

export async function uploadImage(req, res) {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured on server' });
  }

  const bucket = req.params.bucket;
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return res.status(400).json({ error: 'Invalid bucket' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (req.file.size > MAX_BYTES) {
    return res.status(400).json({ error: 'File too large (max 8 MB)' });
  }

  const path = safeName(req.file.originalname);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(path);

  res.json({ url: publicUrl.publicUrl, path, bucket });
}
