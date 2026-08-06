import fs from 'node:fs';
import { Page } from '@playwright/test';
import { Role, STORAGE_STATE } from '../data/users';

/**
 * Claves que Propie guarda en `localStorage`. Se centralizan aquí porque
 * varios tests de regresión asertan directamente sobre ellas: los defectos
 * PROP-BUG-04 y PROP-BUG-06 (ver TEST-STRATEGY.md §2) son precisamente sobre
 * qué se borra y qué no se borra de este almacenamiento.
 */
export const STORAGE_KEYS = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  /**
   * Clave GLOBAL (no lleva el id del usuario) donde se guardan los favoritos.
   * Que no esté namespaced por usuario es la causa raíz de PROP-BUG-04.
   */
  favorites: 'propie_favorite_property_ids',
} as const;

/**
 * Forma del archivo de storageState que escribe Playwright, acotada a lo que
 * se lee acá. Playwright no exporta un tipo público para el contenido del
 * archivo, así que se declara el mínimo en vez de castear a `any`.
 */
interface StorageStateFile {
  origins?: { localStorage?: { name: string; value: string }[] }[];
}

/** El payload de un JWT de Propie, acotado al claim que se usa. */
interface JwtPayload {
  sub: string;
}

/** Lee una clave de localStorage en la página actual. */
export function readStorage(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => window.localStorage.getItem(k), key);
}

/**
 * Pre-carga favoritos antes de que la app arranque.
 *
 * Se siembra el estado en vez de marcar un favorito real haciendo click porque
 * el baseURL es un entorno desplegado y compartido: marcar favoritos por UI
 * dejaría residuo en las cuentas QA si el test falla a mitad de camino. El
 * defecto que se quiere probar no es "el botón marca el favorito" (eso
 * funciona), sino "el logout no limpia esta clave", así que sembrarla es el
 * nivel de aislamiento correcto y además hace el test determinista.
 *
 * Debe llamarse ANTES del primer `goto()`: `addInitScript` se ejecuta en cada
 * documento nuevo, antes de cualquier script de la app.
 */
export async function seedFavorites(page: Page, propertyIds: string[]): Promise<void> {
  await page.addInitScript(
    ([key, ids]) => {
      window.localStorage.setItem(key, JSON.stringify(ids));
    },
    [STORAGE_KEYS.favorites, propertyIds] as const,
  );
}

/**
 * Extrae el `sub` (id de usuario) del accessToken guardado en el storageState
 * de un rol.
 *
 * Se decodifica el JWT en vez de hardcodear los ids porque las cuentas QA se
 * recrean entre entornos: hardcodear un UUID haría que el test fallara por
 * datos, no por el defecto que vigila. Solo se lee el payload (base64url); no
 * se valida la firma, que no es responsabilidad del test.
 */
export function userIdFromStorageState(role: Role): string {
  const raw = JSON.parse(fs.readFileSync(STORAGE_STATE[role], 'utf-8')) as StorageStateFile;
  const origin = raw.origins?.[0];
  const token = origin?.localStorage?.find(
    (entry) => entry.name === STORAGE_KEYS.accessToken,
  )?.value;

  if (!token) {
    throw new Error(
      `No se encontró ${STORAGE_KEYS.accessToken} en ${STORAGE_STATE[role]}. ` +
        '¿Corrió el proyecto "setup"?',
    );
  }

  const payload = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString('utf-8'),
  ) as JwtPayload;
  return payload.sub;
}

/** El accessToken crudo del storageState de un rol, para tests de API. */
export function accessTokenFromStorageState(role: Role): string {
  const raw = JSON.parse(fs.readFileSync(STORAGE_STATE[role], 'utf-8')) as StorageStateFile;
  const token = raw.origins?.[0]?.localStorage?.find(
    (entry) => entry.name === STORAGE_KEYS.accessToken,
  )?.value;

  if (!token) throw new Error(`No se encontró accessToken en ${STORAGE_STATE[role]}.`);
  return token;
}
