import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLD_CLOUD_NAME,
  api_key: process.env.CLD_API_KEY,
  api_secret: process.env.CLD_API_SECRET,
});

export function assertCloudinaryEnv() {
  if (!process.env.CLD_CLOUD_NAME || !process.env.CLD_API_KEY || !process.env.CLD_API_SECRET) {
    throw new Error('Missing Cloudinary env vars');
  }
}

export function cleanSlug(value) {
  return String(value || '').trim();
}

export function isValidSlug(slug) {
  return /^[a-zA-Z0-9_-]+$/.test(String(slug || ''));
}

export function normalizeSlug(value) {
  const slug = cleanSlug(value);
  if (!slug) throw new Error('slug required');
  if (!isValidSlug(slug)) throw new Error('slug only allows letters, numbers, - and _');
  return slug;
}

export function encodeCloudinaryPath(path) {
  return String(path || '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export function dataPublicId(slug) {
  return `collages/${slug}/data`;
}

export function dataDeliveryPublicId(publicId) {
  return /\.json$/i.test(publicId) ? publicId : `${publicId}.json`;
}

export function dataDeliveryUrl(publicId, version) {
  const cloud = process.env.CLD_CLOUD_NAME;
  const deliveryId = dataDeliveryPublicId(publicId);
  const versionPart = version ? `v${version}/` : '';
  return `https://res.cloudinary.com/${cloud}/raw/upload/${versionPart}${encodeCloudinaryPath(deliveryId)}`;
}

function pickNewestDataResource(resources, slug) {
  let chosen = null;
  const escapedSlug = String(slug).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exact = new RegExp(`^collages/${escapedSlug}/data(?:\\.json)?$`, 'i');

  for (const resource of resources || []) {
    const publicId = resource.public_id || '';
    if (!exact.test(publicId)) continue;

    const candidate = {
      public_id: publicId,
      version: Number(resource.version || 0),
    };

    if (!chosen) {
      chosen = candidate;
      continue;
    }

    const candidateHasExt = /\.json$/i.test(candidate.public_id);
    const chosenHasExt = /\.json$/i.test(chosen.public_id);

    if (
      candidate.version > chosen.version ||
      (candidate.version === chosen.version && chosenHasExt && !candidateHasExt)
    ) {
      chosen = candidate;
    }
  }

  return chosen;
}

export async function findDataResource(slug) {
  assertCloudinaryEnv();
  const normalizedSlug = normalizeSlug(slug);
  const prefix = `collages/${normalizedSlug}/`;
  let nextCursor;
  const resources = [];

  do {
    const res = await cloudinary.api.resources({
      resource_type: 'raw',
      type: 'upload',
      prefix,
      max_results: 100,
      next_cursor: nextCursor,
    });
    resources.push(...(res.resources || []));
    nextCursor = res.next_cursor || undefined;
  } while (nextCursor);

  return pickNewestDataResource(resources, normalizedSlug);
}

export async function readPostRecord(slug) {
  const normalizedSlug = normalizeSlug(slug);
  const resource = await findDataResource(normalizedSlug);
  if (!resource) return null;

  const url = dataDeliveryUrl(resource.public_id, resource.version);
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) return null;

  const data = await resp.json().catch(() => null);
  if (!data || typeof data !== 'object') return null;

  return { data, resource, url };
}

export async function unversionedPostExists(slug) {
  const normalizedSlug = normalizeSlug(slug);
  const url = dataDeliveryUrl(dataPublicId(normalizedSlug), null);
  try {
    const resp = await fetch(url, { cache: 'no-store' });
    return resp.ok;
  } catch {
    return false;
  }
}

export function isDeletedRecord(data) {
  return data?.deleted === true || data?.status === 'deleted';
}

export async function uploadPostRecord(slug, record) {
  assertCloudinaryEnv();
  const normalizedSlug = normalizeSlug(slug);
  const jsonBase64 = Buffer.from(JSON.stringify(record)).toString('base64');
  return cloudinary.uploader.upload(
    `data:application/json;base64,${jsonBase64}`,
    {
      resource_type: 'raw',
      public_id: dataPublicId(normalizedSlug),
      overwrite: true,
      format: 'json',
      invalidate: true,
    }
  );
}

export { cloudinary };
