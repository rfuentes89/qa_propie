import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ExplorarPage } from '../pages/ExplorarPage';
import { PerfilPage } from '../pages/PerfilPage';
import { MensajesPage } from '../pages/MensajesPage';
import { MapaPage } from '../pages/MapaPage';
import { PublicarPage } from '../pages/PublicarPage';
import { PropiedadPage } from '../pages/PropiedadPage';

/**
 * Fixtures del framework: inyectan Page Objects ya instanciados en cada test.
 * Así los tests se leen a nivel de negocio y no crean objetos manualmente.
 */
interface Pages {
  loginPage: LoginPage;
  explorarPage: ExplorarPage;
  perfilPage: PerfilPage;
  mensajesPage: MensajesPage;
  mapaPage: MapaPage;
  publicarPage: PublicarPage;
  propiedadPage: PropiedadPage;
}

export const test = base.extend<Pages>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  explorarPage: async ({ page }, use) => {
    await use(new ExplorarPage(page));
  },
  perfilPage: async ({ page }, use) => {
    await use(new PerfilPage(page));
  },
  mensajesPage: async ({ page }, use) => {
    await use(new MensajesPage(page));
  },
  mapaPage: async ({ page }, use) => {
    await use(new MapaPage(page));
  },
  publicarPage: async ({ page }, use) => {
    await use(new PublicarPage(page));
  },
  propiedadPage: async ({ page }, use) => {
    await use(new PropiedadPage(page));
  },
});

export { expect } from '@playwright/test';
