import { APIRequestContext } from '@playwright/test';

export const API_BASE = 'https://propie-api.onrender.com';

/**
 * Busca en el catálogo público una propiedad con al menos `minImages` fotos.
 *
 * Se resuelve por API en vez de hardcodear un id porque el catálogo QA es
 * volátil: durante esta ronda una propiedad referenciada en el testing manual
 * ya había desaparecido (`Propiedad no encontrada`). Un id fijo haría que el
 * test fallara por datos y no por el defecto que vigila.
 *
 * Devuelve `null` si ninguna de las propiedades consultadas llega al mínimo,
 * para que el test pueda omitirse con un motivo claro en vez de fallar.
 */
export async function findPropertyWithImages(
  request: APIRequestContext,
  minImages: number,
  maxToInspect = 15,
): Promise<{ id: string; imageCount: number } | null> {
  const listResponse = await request.get(`${API_BASE}/properties?limit=100`);
  if (!listResponse.ok()) return null;

  const listBody = await listResponse.json();
  const items = listBody.data?.items ?? listBody.data ?? listBody.items ?? [];
  if (!Array.isArray(items)) return null;

  for (const item of items.slice(0, maxToInspect)) {
    const detail = await request.get(`${API_BASE}/properties/${item.id}`);
    if (!detail.ok()) continue;

    const body = await detail.json();
    const images = (body.data ?? body).images ?? [];
    if (Array.isArray(images) && images.length >= minImages) {
      return { id: item.id, imageCount: images.length };
    }
  }

  return null;
}
